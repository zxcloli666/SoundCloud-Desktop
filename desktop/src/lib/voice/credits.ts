export type CreditGroup = 'data' | 'models' | 'code';

export type CreditUse =
  | 'stress'
  | 'lexicon'
  | 'vad'
  | 'asrRu'
  | 'asrEn'
  | 'voiceEn'
  | 'voiceData'
  | 'voiceBase'
  | 'engine'
  | 'tensor'
  | 'runtime'
  | 'inference'
  | 'echo'
  | 'resample'
  | 'stretch';

export interface Credit {
  id: string;
  name: string;
  by?: string;
  license: string;
  url: string;
  group: CreditGroup;
  use: CreditUse;
  files?: string[];
  models?: string[];
}

export const CREDIT_GROUPS: CreditGroup[] = ['data', 'models', 'code'];

export const CREDITS: Credit[] = [
  {
    id: 'wiktionary',
    name: 'Wiktionary',
    by: 'English Wiktionary contributors, kaikki.org',
    license: 'CC BY-SA 4.0',
    url: 'https://en.wiktionary.org/wiki/Wiktionary:Copyrights',
    group: 'data',
    use: 'stress',
    files: ['ru-stress.fst', 'ru-yo.fst', 'ru-suffix.fst'],
  },
  {
    id: 'misaki',
    name: 'misaki',
    by: 'hexgrad',
    license: 'Apache-2.0',
    url: 'https://github.com/hexgrad/misaki',
    group: 'data',
    use: 'lexicon',
    files: ['en-us.fst', 'en-us.ph'],
  },
  {
    id: 'silero-vad',
    name: 'Silero VAD',
    by: 'snakers4',
    license: 'MIT',
    url: 'https://github.com/snakers4/silero-vad',
    group: 'models',
    use: 'vad',
    models: ['silero-vad'],
  },
  {
    id: 'vosk',
    name: 'Vosk',
    by: 'Alpha Cephei',
    license: 'Apache-2.0',
    url: 'https://alphacephei.com/vosk/models',
    group: 'models',
    use: 'asrRu',
    models: ['sherpa-onnx-streaming-zipformer-small-ru-vosk'],
  },
  {
    id: 'gigaam',
    name: 'GigaAM v3',
    by: 'salute-developers',
    license: 'MIT',
    url: 'https://github.com/salute-developers/GigaAM',
    group: 'models',
    use: 'asrRu',
    models: ['sherpa-onnx-nemo-transducer-giga-am-v3'],
  },
  {
    id: 'moonshine',
    name: 'Moonshine',
    by: 'Useful Sensors',
    license: 'MIT',
    url: 'https://github.com/usefulsensors/moonshine',
    group: 'models',
    use: 'asrEn',
    models: ['sherpa-onnx-moonshine'],
  },
  {
    id: 'kokoro',
    name: 'Kokoro-82M',
    by: 'hexgrad',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/hexgrad/Kokoro-82M',
    group: 'models',
    use: 'voiceEn',
    models: ['kokoro'],
  },
  {
    id: 'siwis',
    name: 'SIWIS',
    license: 'CC BY',
    url: 'https://datashare.ed.ac.uk/handle/10283/2353',
    group: 'models',
    use: 'voiceData',
  },
  {
    id: 'koniwa',
    name: 'Koniwa',
    by: 'koniwa',
    license: 'CC BY',
    url: 'https://github.com/koniwa/koniwa',
    group: 'models',
    use: 'voiceData',
  },
  {
    id: 'qwen-tts',
    name: 'Qwen3-TTS',
    by: 'Qwen',
    license: 'Apache-2.0',
    url: 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base',
    group: 'models',
    use: 'voiceBase',
    models: ['qwen-codec', 'qwen-loli', 'qwen-moriarty'],
  },
  {
    id: 'qwentts',
    name: 'qwentts.cpp',
    by: 'ServeurpersoCom',
    license: 'MIT',
    url: 'https://github.com/ServeurpersoCom/qwentts.cpp',
    group: 'models',
    use: 'engine',
    models: ['qwen-engine'],
  },
  {
    id: 'ggml',
    name: 'ggml',
    by: 'The ggml authors',
    license: 'MIT',
    url: 'https://github.com/ggml-org/ggml',
    group: 'models',
    use: 'tensor',
  },
  {
    id: 'sherpa-onnx',
    name: 'sherpa-onnx',
    by: 'k2-fsa',
    license: 'Apache-2.0',
    url: 'https://github.com/k2-fsa/sherpa-onnx',
    group: 'code',
    use: 'runtime',
  },
  {
    id: 'onnxruntime',
    name: 'ONNX Runtime',
    by: 'Microsoft',
    license: 'MIT',
    url: 'https://github.com/microsoft/onnxruntime',
    group: 'code',
    use: 'inference',
  },
  {
    id: 'sonora',
    name: 'sonora',
    by: 'dignifiedquire',
    license: 'BSD-3-Clause',
    url: 'https://github.com/dignifiedquire/sonora',
    group: 'code',
    use: 'echo',
  },
  {
    id: 'rubato',
    name: 'Rubato',
    by: 'HEnquist',
    license: 'MIT',
    url: 'https://github.com/HEnquist/rubato',
    group: 'code',
    use: 'resample',
  },
  {
    id: 'signalsmith-stretch',
    name: 'Signalsmith Stretch',
    by: 'Signalsmith Audio, Colin Marc',
    license: 'MIT',
    url: 'https://github.com/colinmarc/signalsmith-stretch-rs',
    group: 'code',
    use: 'stretch',
  },
];

export function creditsOf(group: CreditGroup): Credit[] {
  return CREDITS.filter((credit) => credit.group === group);
}
