# Upload list

Base: `s3://<bucket>/voice-models/<id>/<version>/<path>`, public at `https://storage.scnative.dev/voice-models/<id>/<version>/<path>` (constant `STORAGE_BASE` in `src/manifest.rs`). Files are uploaded unpacked, one object per file, exact bytes, no compression.

Source: `/Users/loli/Developer/SoundCloud/.worktrees/voice-cache/models/` (upstream sherpa-onnx `asr-models` release files, unchanged). `bpe.vocab` (in the Vosk model) is ours, not upstream: generated from `bpe.model` with sentencepiece in podman (`id_to_piece(i)\tget_score(i)` per line); regenerating gives the same sha256.

License field: third-party models keep their license name (MIT, Apache-2.0, ...); our own models (wake word, our Russian voices) carry `own`.

Cache: objects are immutable per version path; long Cache-Control is fine. Range requests must work (206 with Content-Range).

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

## sherpa-onnx-moonshine-base-en-quantized-2026-02-27 (version 1, asr, en, MIT)

Total 141300566 bytes.

| target path | size | sha256 |
|---|---|---|
| voice-models/sherpa-onnx-moonshine-base-en-quantized-2026-02-27/1/encoder_model.ort | 31326816 | 7c66495948d0d08ec1af454cd4b5514862ae6511e94712a60e6d83eaec8dc8cf |
| voice-models/sherpa-onnx-moonshine-base-en-quantized-2026-02-27/1/decoder_model_merged.ort | 109424400 | d9d7b333af34bc552580576ddcf248a1c6c839e0d3b43b09afb9376ed009899d |
| voice-models/sherpa-onnx-moonshine-base-en-quantized-2026-02-27/1/tokens.txt | 549350 | 2870d843e14c1e187bf1913a521562a63b53933814bd7f2145120468f494a049 |


## kokoro-int8-multi-lang-v1_0 (version 1, tts, en, Apache-2.0)

Total 142404640 bytes. Source: `voice-cache/tts/kokoro8/kokoro-int8-multi-lang-v1_0/` (sherpa-onnx `tts-models` release `kokoro-int8-multi-lang-v1_0.tar.bz2`, unchanged). Only these three files: the engine passes our own phonemes, so the lexicons, `dict/`, the zh fst files and espeak data are not shipped. Speakers used: af_heart 3, am_michael 16 (read from the model's `speaker2id` metadata).

| target path | size | sha256 |
|---|---|---|
| voice-models/kokoro-int8-multi-lang-v1_0/1/model.int8.onnx | 114202993 | 75635ea3b85a32d00094dcdd61a258aba87c160f7c264c304a7b3ae9d734195e |
| voice-models/kokoro-int8-multi-lang-v1_0/1/voices.bin | 28200960 | 1c5a5b983d3d50d8586d437a51f3faa2da7919ce76a013c081e65671a3447c29 |
| voice-models/kokoro-int8-multi-lang-v1_0/1/tokens.txt | 687 | 6ebb6bb288f20f3ae8d004d3c2ca27697da27c037d75e81a60e2a6a663f95425 |
