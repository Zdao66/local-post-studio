"""Optional Intel NPU inference for the windowed recognition worker."""
import math
import sys
import time


def runtime_ready(root):
    directory = root / 'work/npu-runtime'
    return ((directory/'packages/openvino_genai/__init__.py').is_file()
            and all((directory/'model'/file).is_file() for file in (
                'openvino_encoder_model.xml','openvino_encoder_model.bin',
                'openvino_decoder_model.xml','openvino_decoder_model.bin',
                'openvino_tokenizer.xml','openvino_tokenizer.bin',
                'openvino_detokenizer.xml','openvino_detokenizer.bin','generation_config.json')))


def recognize_npu(root, samples, language, offset, progress):
    if not runtime_ready(root):
        raise ValueError('Intel NPU 实验组件或 Whisper Base 模型未准备好。')
    directory = root / 'work/npu-runtime'
    sys.path.insert(0,str(directory/'packages'))
    progress('正在加载 OpenVINO NPU…')
    import openvino as ov
    import openvino_genai
    if 'NPU' not in ov.Core().available_devices:
        raise ValueError('没有检测到可用的 Intel NPU，请切回 CPU。')
    progress('正在准备 NPU 模型…')
    started = time.perf_counter()
    pipe = openvino_genai.WhisperPipeline(str(directory/'model'),'NPU',CACHE_DIR=str(directory/'compiled'))
    load_seconds = time.perf_counter() - started
    progress('正在使用 NPU 识别音频…')
    started = time.perf_counter()
    options = {'task':'transcribe','return_timestamps':True}
    if language:
        options['language'] = f'<|{language}|>'
    result = pipe.generate(samples,**options)
    seconds = time.perf_counter()-started
    duration = len(samples)/16000
    rows = []
    for chunk in result.chunks:
        start, end = chunk.start_ts, chunk.end_ts
        text = chunk.text.strip()
        if text and math.isfinite(start) and math.isfinite(end):
            start, end = max(0,start), min(duration,end)
            if start < end:
                rows.append({'start':start+offset,'end':end+offset,'text':text})
    rows.sort(key=lambda row:row['start'])
    return {'language':language,'rows':rows,'backend':'npu',
            'timings':{'load_seconds':load_seconds,'inference_seconds':seconds}}
