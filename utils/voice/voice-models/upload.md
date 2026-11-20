# Upload list

Base: `s3://<bucket>/voice-models/<id>/<version>/<path>`, public at `https://storage.scnative.dev/voice-models/<id>/<version>/<path>` (constant `STORAGE_BASE` in `src/manifest.rs`). Files are uploaded unpacked, one object per file, exact bytes, no compression.

Source: `/Users/loli/Developer/SoundCloud/.worktrees/voice-cache/models/` (upstream sherpa-onnx `asr-models` release files, unchanged). `bpe.vocab` (in the Vosk and GigaSpeech models) is ours, not upstream: one `piece\tscore` line per token of `bpe.model`. The Vosk one was generated with sentencepiece in podman (`id_to_piece(i)\tget_score(i)`); `bpe_vocab.py` reads the model file itself and gives the same sha256 for it.

License field: third-party models keep their license name (MIT, Apache-2.0, ...); our own models (wake word, our Russian voices) carry `own`.

Cache: objects are immutable per version path; long Cache-Control is fine. Range requests must work (206 with Content-Range).

Retired: a model id that is dropped from `manifest.json` goes into its `retired` list, and the app deletes that folder from the disk on the next start. The objects stay in the storage for older app versions.

## silero-vad (version 1, vad, any, MIT)

Total 643854 bytes.

| target path | size | sha256 |
|---|---|---|
| voice-models/silero-vad/1/silero_vad.onnx | 643854 | 9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6 |

## sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16 (version 1, asr, ru, Apache-2.0)

Total 28833045 bytes.

| target path | size | sha256 |
|---|---|---|
| voice-models/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16/1/encoder.int8.onnx | 26214060 | e0db705e94ec35d803b1df4f40cda23d064e1142977c80ab288430b109777a9d |
| voice-models/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16/1/decoder.onnx | 2093080 | 89b3088a9e20e1ef7f2e85ce1a3478afe6a9c4ac57369cabcc4beb8e95328ea0 |
| voice-models/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16/1/joiner.int8.onnx | 259417 | b55784b071ab7512eab4c7c44e4f5478284ef33c83562cc6a249b972515a31e5 |
| voice-models/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16/1/tokens.txt | 6388 | 93bbbc0bae6b78c0bbb743d4aa9fded3bb5ff3aac5f0200e3a769a5a05e0fdf6 |
| voice-models/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16/1/bpe.model | 246184 | c7a756aeb3550417d6b2ed3efde9a7aa3eea54787d4eac011e9cce6090c9c64a |
| voice-models/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16/1/bpe.vocab | 13916 | 52649881bb41fafe4257c74d77a85320524494a9d8c48e93d4aaa216cc45113d |

## sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16 (version 1, asr, ru, MIT)

Total 229343109 bytes.

| target path | size | sha256 |
|---|---|---|
| voice-models/sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16/1/encoder.int8.onnx | 224570814 | 0ec54e5f130a91c0f228d21795ede10b31c992a1f73e45dcd827e843a71a9b50 |
| voice-models/sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16/1/decoder.onnx | 3331651 | 5d1cfef155d8e07f213bd2f3229b5f6c5c29355c7fa5c1b9eb62cb1925725254 |
| voice-models/sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16/1/joiner.onnx | 1440448 | fd1d02f45c2ad3d6b67cc149811ad794ab4b020ed49a0a9e2790a8619d1cddd8 |
| voice-models/sherpa-onnx-nemo-transducer-giga-am-v3-russian-2025-12-16/1/tokens.txt | 196 | 17cc514451bcceac9c280068c71502f8448f99e9fb1456b8d0761651fd0392f2 |

## sherpa-onnx-zipformer-gigaspeech-2023-12-12 (version 1, asr, en, Apache-2.0)

Total 75220808 bytes. Source: sherpa-onnx `asr-models` release `sherpa-onnx-zipformer-gigaspeech-2023-12-12.tar.bz2`: the int8 encoder and joiner and the full decoder, renamed to the names below, and `tokens.txt` unchanged. `bpe.vocab` is ours: `python3 bpe_vocab.py bpe.model bpe.vocab` (next to this file) writes one `piece\tscore` line per token of the release's `bpe.model`. It replaced `sherpa-onnx-moonshine-base-en-quantized-2026-02-27` (141300566 bytes), which took no name hints.

| target path | size | sha256 |
|---|---|---|
| voice-models/sherpa-onnx-zipformer-gigaspeech-2023-12-12/1/encoder.int8.onnx | 72850738 | d3eff4b1bd747bd781a47966795988539227d05638524b0313f26d3a166962d7 |
| voice-models/sherpa-onnx-zipformer-gigaspeech-2023-12-12/1/decoder.onnx | 2093081 | 852b65653e65ec5436b61ab8cea819847666c1dd4c5821a94989788f85adbe76 |
| voice-models/sherpa-onnx-zipformer-gigaspeech-2023-12-12/1/joiner.int8.onnx | 259417 | 80160e45cca71dd52f6b0a6d3d12be18126f5308b2d4ba03f001300fea377c64 |
| voice-models/sherpa-onnx-zipformer-gigaspeech-2023-12-12/1/tokens.txt | 5020 | 0ef7d736bf4de3ef947292e4b119ef13f6808cd5f3aec225a843a7135ac1c2ce |
| voice-models/sherpa-onnx-zipformer-gigaspeech-2023-12-12/1/bpe.vocab | 12552 | 803718d32d9858e47a5f764ae58c538ea370ecb5db3d58e98a8cda0b31bf4111 |

## kokoro-multi-lang-v1_0 (version 1, tts, en, Apache-2.0)

Total 353762203 bytes. Source: sherpa-onnx `tts-models` release `kokoro-multi-lang-v1_0.tar.bz2`, unchanged. Only these three files: the engine passes our own phonemes, so the lexicons, `dict/`, the zh fst files and espeak data are not shipped. Speakers used: af_heart 3, am_michael 16 (read from the model's `speaker2id` metadata). The int8 build of the same model (`kokoro-int8-multi-lang-v1_0`, 142404640 bytes) was shipped first and is slower than real time on Apple M1; this one takes about half the time on two threads.

| target path | size | sha256 |
|---|---|---|
| voice-models/kokoro-multi-lang-v1_0/1/model.onnx | 325560556 | b40f62b166ac8164b0627ef48a0b358eda0985e272fb03ef5252e7206305da11 |
| voice-models/kokoro-multi-lang-v1_0/1/voices.bin | 28200960 | 1c5a5b983d3d50d8586d437a51f3faa2da7919ce76a013c081e65671a3447c29 |
| voice-models/kokoro-multi-lang-v1_0/1/tokens.txt | 687 | 6ebb6bb288f20f3ae8d004d3c2ca27697da27c037d75e81a60e2a6a663f95425 |

# Qwen voices

The speech engine is a separate program, `scd-qwen`, started by the app. A Qwen voice needs three models: the engine for the platform, `qwen-codec` and the voice itself.

## qwen-codec (version 1, tts, any, Apache-2.0)

Total 291150624 bytes. Source: `voice-data/train-work/gguf/models/`. The 12 Hz speech tokenizer of Qwen3-TTS (Apache-2.0), exported to GGUF Q8_0 by `Internal/voice-lab` (TRAINING.md, section 9). Shared by every Qwen voice.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-codec/1/qwen-tokenizer-12hz-Q8_0.gguf | 291150624 | 1883beeed99348fc35e23dd225e9082f93f6f8c109330a33d935baa8acdbfd94 |

## qwen-loli (version 1, tts, ru, own)

Total 1182631008 bytes. Source: `voice-data/train-work/gguf/models/`. Qwen3-TTS-12Hz-1.7B-Base with our Loli adapter (epoch 8) merged, Q4_K_M. Speaker name inside the file: `loli`.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-loli/1/qwen-talker-1.7b-loli-Q4_K_M.gguf | 1182631008 | dadc36ad7c33ffe2334a06f52cc8f7f498320e7b3834556703e2c0f8b33bc944 |

## qwen-moriarty (version 1, tts, ru, own)

Total 1182631008 bytes. Source: `voice-data/train-work/gguf/models/`. Qwen3-TTS-12Hz-1.7B-Base with our Moriarty adapter (epoch 3) merged, Q4_K_M. Speaker name inside the file: `moriarty`.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-moriarty/1/qwen-talker-1.7b-moriarty-Q4_K_M.gguf | 1182631008 | f2edb2cfb74dc4b5952a249a057814f99bd7498cea04879befbe109cf623ecb2 |


# Speech engine

Source: `voice-data/train-work/gguf/engines-43646330129/<platform>/`, the artifacts `qwen-engine-<platform>` of the `Voice engine` workflow run 43646330129 (commit f1934bf8). Built from `utils/voice/qwen-engine/` on qwentts.cpp `de2ad833` (MIT) with ggml (MIT). Each platform is its own model with `platform` set, so the app sees only its own. The program is the file marked `executable` in the manifest; the store sets its run bit after the download.

A new build is a new version: bump `version`, upload to the new path, never replace files of a published version.

## qwen-engine-macos-aarch64 (version 2, engine, macos-aarch64, MIT)

Total 7503864 bytes, 1 files. Metal and CPU, one file.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-engine-macos-aarch64/2/scd-qwen | 7503864 | e31932508d0aa3facda7e2a40eb748b7a0846aa80deffc062cef0de663c5546b |

## qwen-engine-macos-x86_64 (version 2, engine, macos-x86_64, MIT)

Total 2527080 bytes, 1 files. CPU only, one file.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-engine-macos-x86_64/2/scd-qwen | 2527080 | d2b70f95ce185ffa80a401bbd974b2b3f55eafc9cda8042abf7b8e8ab0123530 |

## qwen-engine-linux-x86_64 (version 3, engine, linux-x86_64, MIT)

Total 53013960 bytes, 18 files. CPU variants picked at run time, Vulkan when the system has a driver. glibc 2.35 or newer.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-engine-linux-x86_64/3/scd-qwen | 408024 | 4b6fb96d4556c3abc4d9588f58e9be365a65ad594977bbfb5915a2eb5398170b |
| voice-models/qwen-engine-linux-x86_64/3/libggml-base.so.0 | 937296 | d9ea1fc950ff08de6c927ca46e22a8ed081c6edc42bee4aea55a498569881a2c |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-alderlake.so | 1294424 | 495d5ea066ae1945e6980b361e387581cc6f1dd9ad73e4646e47b01c0eb1ded5 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-cannonlake.so | 1376456 | b398d061293c9138286bc2896e687ca107280acce28ee595660425f39b90a9d6 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-cascadelake.so | 1392544 | fd496fd6582c025bf819ec13130dcb7796bfea2ac5c1c4407762471168af9102 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-cooperlake.so | 1392544 | abded0c896d877b42812675ee53a9450bfc99826b6039b6af2506d1805e5c18d |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-haswell.so | 1294424 | 64d47ea00ff4401914f15ce6f2dcc3d77799746379c60881008929d41b66b13c |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-icelake.so | 1392544 | 8b7b289f3e81b4cbc1e31448d0cdddbb31f451f9742c74444ecbed1022ed8b88 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-ivybridge.so | 1227208 | 09221b19d06007d87e3a0c6e1a4abdfd18591da119bc43121f81a58602d94365 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-piledriver.so | 1227208 | 4f0be205cb5607ce1a527f25686217179ed83f9faef0cfde7f206de2ee26c73d |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-sandybridge.so | 1247856 | 7ed149113743a01871662f94f51531e4f06f20cb8255c04797e04e3b8287c52d |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-sapphirerapids.so | 1688776 | 724cb4d75cd14fc1ae74282ef28f27cea68040627afb2c0de98dfd400b2fa39e |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-skylakex.so | 1376456 | 76c611c8e156aace3c30c225231cfa396d644171f6655cca34fc7a08831ce240 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-sse42.so | 980840 | e99f5352057fbf823a7826116589c775bd557b8b2fd466c2483479d40f36925e |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-x64.so | 980960 | 8a7ff79d27fa7168e43c16d552dc578c8dc75029850534eb105ff6ed805406d2 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-cpu-zen4.so | 1392544 | 38aea82ad8d4d2506f28899e16192bbc8f7fef242d0baad13a2cdfb90fab4715 |
| voice-models/qwen-engine-linux-x86_64/3/libggml-vulkan.so | 33352816 | 487a41eb8f31f23ea369884ee476d9d75daad685859958b6ac490c466a28a756 |
| voice-models/qwen-engine-linux-x86_64/3/libggml.so.0 | 51040 | de890b08e24547b45326b4283ffe8ab8eed542fe49158f5a8c6bd2dee6e67e82 |

Not in the manifest, same folder: `libggml-cuda.so` from the artifact `qwen-engine-linux-x86_64-cuda`. Only a server worker with an NVIDIA card loads it.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-engine-linux-x86_64/3/libggml-cuda.so | 224729432 | 4153982453a339648ae9003222faf54f80858e762c8c85f130f02c76d7878369 |


## qwen-engine-linux-aarch64 (version 2, engine, linux-aarch64, MIT)

Total 1991296 bytes, 1 files. CPU only (ARMv8.2 with dotprod and fp16), one file. glibc 2.35 or newer.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-engine-linux-aarch64/2/scd-qwen | 1991296 | 6ee9298127540123bfe5fb7f398328963b020795f28ea82b00ddb25c00d19162 |

## qwen-engine-windows-x86_64 (version 2, engine, windows-x86_64, MIT)

Total 51458352 bytes, 16 files. CPU variants picked at run time, Vulkan when the system has a driver. The three MSVC runtime files ship next to the program.

| target path | size | sha256 |
|---|---|---|
| voice-models/qwen-engine-windows-x86_64/2/scd-qwen.exe | 316416 | ead2edd4c786eaee37f84ade09a00337ad0d7017e608d0fdb8aeb83100381e02 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-base.dll | 714752 | 5800f7a7467a612e1eaa9444591727ffcf5766ed951e95ec9710fb5311fc9a14 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-alderlake.dll | 999424 | 128f303916e9b12391e2811da4e55ae3b754e3cd93c075db3952fbb8bdeb6e28 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-cannonlake.dll | 1041408 | dd1a6525c0f63d607f39f69b75eeea50d0f36c0999eeef6e67d19e809ea98fbe |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-cascadelake.dll | 1055232 | cab1b6cbd6b7e5f4009e871a5064aab303555fd6dda79492ae0600464f92c9b0 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-haswell.dll | 1000960 | a7e0e4f7234cb4b7fe0aa2c99e47718213531f603203788c4cdab6d710f2fa4f |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-icelake.dll | 1055232 | 73989eb5ebdda18b510f616d4fd221b725859fce27012319677eceef5c38da05 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-sandybridge.dll | 1048064 | d897a1885c8c8410ab23a1c3be6fc996ef7a93755111b954783f530720eb0d23 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-skylakex.dll | 1041408 | 1f91ee18d708f29e85afc2d1aff1de93b2e6f193497f087cd60e7126aa2fad9c |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-sse42.dll | 883712 | 54c42da8f5f88c3adfbaaed2fc3c3b2be2f1b7f595760be79ec9d139f6ed9be6 |
| voice-models/qwen-engine-windows-x86_64/2/ggml-cpu-x64.dll | 887296 | c046da9a6e67f99723cba9ab3d4ea584e7464bfeecefa025a743dfa67d5ec5ce |
| voice-models/qwen-engine-windows-x86_64/2/ggml-vulkan.dll | 40480256 | 0b300e284aa3523be62a12c273c3aa38ac829e9b9336bd8345ad3d60d1bae4bb |
| voice-models/qwen-engine-windows-x86_64/2/ggml.dll | 61952 | 32ca6a1955936e85639b03bfddc19e67780a466c33d7692349110e2533738c20 |
| voice-models/qwen-engine-windows-x86_64/2/msvcp140.dll | 643512 | 7c26614e1d733892c2deac7e245ce115504b1d80592dd0a01b08e3e5a55f89ca |
| voice-models/qwen-engine-windows-x86_64/2/vcruntime140.dll | 178616 | d1f4225df2cd877dbf130d5668a021dce3f94118455ff5ec952061c30afc9ce7 |
| voice-models/qwen-engine-windows-x86_64/2/vcruntime140_1.dll | 50112 | a7146c08f89fe5b04541ab507cdb59ff7b44534d4ba3c668a426c6450a03434e |
