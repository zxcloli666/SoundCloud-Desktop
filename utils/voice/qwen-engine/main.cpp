#include "ggml-backend.h"
#include "qwen.h"

#include <atomic>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

namespace {

enum Kind : uint8_t {
    Say    = 'S',
    Cancel = 'C',
    Ready  = 'R',
    Audio  = 'A',
    Done   = 'D',
    Failed = 'E',
};

const size_t HEAD = 9;
const uint32_t MAX_PAYLOAD = 1 << 20;

struct Job {
    uint32_t    id;
    int64_t     seed;
    int         max_tokens;
    std::string speaker;
    std::string lang;
    std::string text;
};

std::mutex              out_lock;
std::mutex              queue_lock;
std::condition_variable queue_ready;
std::deque<Job>         queue;
bool                    closed = false;
std::atomic<uint32_t>   cancelled{0};

void put_u32(uint8_t * at, uint32_t value) {
    for (int i = 0; i < 4; i++) {
        at[i] = (uint8_t) (value >> (8 * i));
    }
}

uint32_t get_u32(const uint8_t * at) {
    uint32_t value = 0;
    for (int i = 0; i < 4; i++) {
        value |= (uint32_t) at[i] << (8 * i);
    }
    return value;
}

bool send(Kind kind, uint32_t id, const void * data, size_t size) {
    uint8_t head[HEAD];
    head[0] = kind;
    put_u32(head + 1, id);
    put_u32(head + 5, (uint32_t) size);
    std::lock_guard<std::mutex> hold(out_lock);
    return fwrite(head, 1, HEAD, stdout) == HEAD && (size == 0 || fwrite(data, 1, size, stdout) == size) &&
           fflush(stdout) == 0;
}

bool send_text(Kind kind, uint32_t id, const std::string & text) {
    return send(kind, id, text.data(), text.size());
}

bool is_cancelled(uint32_t id) {
    return id <= cancelled.load();
}

void cancel_up_to(uint32_t id) {
    uint32_t seen = cancelled.load();
    while (id > seen && !cancelled.compare_exchange_weak(seen, id)) {
    }
}

bool parse(uint32_t id, const std::string & payload, Job * job) {
    std::string fields[4];
    size_t      at = 0;
    for (std::string & field : fields) {
        size_t end = payload.find('\n', at);
        if (end == std::string::npos) {
            return false;
        }
        field = payload.substr(at, end - at);
        at    = end + 1;
    }
    job->id         = id;
    job->seed       = std::strtoll(fields[0].c_str(), nullptr, 10);
    job->max_tokens = std::atoi(fields[1].c_str());
    job->speaker    = fields[2];
    job->lang       = fields[3];
    job->text       = payload.substr(at);
    return job->max_tokens > 0 && !job->text.empty();
}

void speak(qt_context * engine, const Job & job) {
    uint32_t      id = job.id;
    qt_tts_params params;
    qt_tts_default_params(&params);
    params.text             = job.text.c_str();
    params.lang             = job.lang.c_str();
    params.speaker          = job.speaker.c_str();
    params.seed             = job.seed;
    params.max_new_tokens   = job.max_tokens;
    params.cancel_user_data = &id;
    params.cancel           = [](void * id) { return is_cancelled(*(uint32_t *) id); };
    params.on_chunk_user_data = &id;
    params.on_chunk           = [](const float * samples, int count, void * id) {
        return send(Audio, *(uint32_t *) id, samples, (size_t) count * sizeof(float));
    };
    qt_audio  unused = {};
    qt_status status = qt_synthesize(engine, &params, &unused);
    qt_audio_free(&unused);
    if (status == QT_STATUS_OK || status == QT_STATUS_CANCELLED) {
        send(Done, id, nullptr, 0);
    } else {
        send_text(Failed, id, qt_last_error());
    }
}

void work(qt_context * engine) {
    for (;;) {
        std::unique_lock<std::mutex> hold(queue_lock);
        queue_ready.wait(hold, [] { return closed || !queue.empty(); });
        if (queue.empty()) {
            return;
        }
        Job job = std::move(queue.front());
        queue.pop_front();
        hold.unlock();
        if (is_cancelled(job.id)) {
            send(Done, job.id, nullptr, 0);
        } else {
            speak(engine, job);
        }
    }
}

bool read_exact(void * into, size_t size) {
    return fread(into, 1, size, stdin) == size;
}

void listen() {
    uint8_t     head[HEAD];
    std::string payload;
    while (read_exact(head, HEAD)) {
        uint32_t id   = get_u32(head + 1);
        uint32_t size = get_u32(head + 5);
        if (size > MAX_PAYLOAD) {
            return;
        }
        payload.resize(size);
        if (!read_exact(&payload[0], size)) {
            return;
        }
        if (head[0] == Cancel) {
            cancel_up_to(id);
        } else if (head[0] == Say) {
            Job job;
            if (!parse(id, payload, &job)) {
                send_text(Failed, id, "bad request");
                continue;
            }
            std::lock_guard<std::mutex> hold(queue_lock);
            queue.push_back(std::move(job));
            queue_ready.notify_one();
        }
    }
}

std::string device_name(const char * asked) {
    if (asked) {
        return asked;
    }
    ggml_backend_dev_t best = ggml_backend_dev_by_type(GGML_BACKEND_DEVICE_TYPE_GPU);
    if (!best) {
        best = ggml_backend_dev_by_type(GGML_BACKEND_DEVICE_TYPE_IGPU);
    }
    return best ? ggml_backend_dev_name(best) : "CPU";
}

void log_line(qt_log_level level, const char * line, void *) {
    if (level >= QT_LOG_WARN) {
        fprintf(stderr, "%s\n", line);
    }
}

}

int main(int argc, char ** argv) {
    if (argc < 3) {
        fprintf(stderr, "usage: scd-qwen <talker.gguf> <codec.gguf> [device]\n");
        return 2;
    }
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    qt_log_set(log_line, nullptr);
    qt_init_params init;
    qt_init_default_params(&init);
    init.talker_path = argv[1];
    init.codec_path  = argv[2];
    init.device      = argc > 3 ? argv[3] : nullptr;
    qt_context * engine = qt_init(&init);
    if (!engine) {
        send_text(Failed, 0, qt_last_error());
        return 1;
    }
    send_text(Ready, 0, "24000\n" + device_name(init.device));

    std::thread worker(work, engine);
    listen();
    cancel_up_to(UINT32_MAX);
    {
        std::lock_guard<std::mutex> hold(queue_lock);
        queue.clear();
        closed = true;
    }
    queue_ready.notify_one();
    worker.join();
    qt_free(engine);
    return 0;
}

