#!/usr/bin/env python3
"""
本地语音识别服务 - Faster-Whisper
使用方法: python voice_server.py

启动后会在 http://localhost:8765 提供语音识别API
"""

import os
import base64
import tempfile
import asyncio
import json
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# 繁简转换映射表
T2S_MAP = {
    # 排队相关
    '排隊': '排队', '排成一排': '排成一排', '所有寵物': '所有宠物', '寵物': '宠物',
    # 过来
    '過來': '过来',
    # 常见混淆字
    '頭': '头', '麵': '面', '樣': '样', '國': '国', '們': '们',
    '為': '为', '葉': '叶', '麼': '么', '過': '过', '來': '来',
    '長': '长', '見': '见', '業': '业', '創': '创', '麗': '丽',
    '參': '参', '極': '极', '確': '确', '員': '员', '夥': '伙',
    '廣': '广', '場': '场', '雖': '虽', '獵': '猎', '報': '报',
    '導': '导', '鳥': '鸟', '奮': '奋', '飛': '飞', '沖': '冲',
    '澤': '泽', '潤': '润', '災': '灾', '變': '变', '兒': '儿',
    '關': '关', '務': '务', '質': '质', '積': '积', '壓': '压',
    '恥': '耻', '鐵': '铁', '鏟': '铲', '鏈': '链', '錯': '错',
    '鎮': '镇', '電': '电', '靈': '灵', '雲': '云', '務': '务',
    '協': '协', '卻': '却', '廠': '厂', '廈': '厦', '廚': '厨',
    '聽': '听', '聯': '联', '號': '号', '剛': '刚', '創': '创',
    '別': '别', '勝': '胜', '動': '动', '勢': '势', '區': '区',
    '醫': '医', '華': '华', '萬': '万', '蓋': '盖', '蔔': '卜',
    '處': '处', '蟲': '虫', '蝦': '虾', '螢': '萤', '術': '术',
    '衛': '卫', '衛': '卫', '錶': '表', '裡': '里', '復': '复',
    '認': '认', '論': '论', '許': '许', '豐': '丰', '貝': '贝',
    '貞': '贞', '敗': '败', '賈': '贾', '責': '责', '賢': '贤',
    '質': '质', '賬': '账', '買': '买', '費': '费', '資': '资',
    '賦': '赋', '質': '质', '賭': '赌', '責': '责', '賽': '赛',
    '贈': '赠', '贏': '赢', '贊': '赞', '趙': '赵', '跡': '迹',
    '路': '路', '躍': '跃', '車': '车', '軌': '轨', '軍': '军',
    '軟': '软', '載': '载', '輕': '轻', '輪': '轮', '輸': '输',
    '辦': '办', '農': '农', '這': '这', '逹': '达', '進': '进',
    '遠': '远', '連': '连', '週': '周', '遊': '游', '運': '运',
    '過': '过', '達': '达', '適': '适', '遲': '迟', '還': '还',
    '邊': '边', '邏': '逻', '郦': '郦', '鄭': '郑', '醫': '医',
    '針': '针', '銅': '铜', '錢': '钱', '錫': '锡', '錯': '错',
    '錄': '录', '鏟': '铲', '鏈': '链', '鏡': '镜', '長': '长',
    '門': '门', '閉': '闭', '開': '开', '間': '间', '關': '关',
    '陳': '陈', '陽': '阳', '隊': '队', '雲': '云', '電': '电',
    '靑': '青', '非': '非', '韋': '韦', '韓': '韩', '響': '响',
    '頁': '页', '項': '项', '順': '顺', '須': '须', '顧': '顾',
    '預': '预', '頭': '头', '題': '题', '顯': '显', '風': '风',
    '飛': '飞', '養': '养', '餘': '余', '館': '馆', '馬': '马',
    '駕': '驾', '驗': '验', '體': '体', '髮': '发', '魚': '鱼',
    '魯': '鲁', '鮑': '鲍', '麥': '麦', '黃': '黄', '黑': '黑',
    '點': '点', '齊': '齐', '齡': '龄', '龍': '龙', '龜': '龟',
}


def to_simplified(text: str) -> str:
    """将繁体/混合中文转为简体"""
    result = text
    # 先用字典替换（处理多字词）
    for trad, simp in T2S_MAP.items():
        result = result.replace(trad, simp)
    return result


# 识别日志文件
LOG_FILE = Path(__file__).parent / "voice_recognize.log"


def log_recognition(audio_size: int, original: str, converted: str, command_matched: str = None):
    """记录识别日志"""
    entry = {
        "time": datetime.now().isoformat(),
        "audio_size": audio_size,
        "raw_text": original,
        "converted_text": converted,
        "command_matched": command_matched,
    }
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"⚠️ 日志写入失败: {e}")
    return entry

# 尝试导入 faster-whisper，如果没装会提示安装
try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("⚠️ faster-whisper 未安装，运行: pip install faster-whisper")

app = FastAPI(title="本地语音识别服务")

# CORS - 允许本地前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局模型实例
model = None
MODEL_PATH = None  # 模型路径，None时自动下载

# 支持的模型尺寸
MODEL_SIZES = {
    "tiny": "tiny",
    "base": "base",
    "small": "small",
    "medium": "medium",
    "large-v3": "large-v3",
}

# 默认使用 tiny 模型（最快，资源占用小）
DEFAULT_MODEL = "base"
current_model_size = DEFAULT_MODEL


def load_model(size: str = DEFAULT_MODEL):
    """加载 Faster-Whisper 模型"""
    global model, current_model_size, MODEL_PATH

    if not WHISPER_AVAILABLE:
        raise RuntimeError("faster-whisper 未安装，请运行: pip install faster-whisper")

    if model and current_model_size == size:
        return model

    print(f"🔄 加载 Faster-Whisper 模型: {size} ...")

    # 如果没有指定模型路径，使用默认方式（会自动下载）
    if MODEL_PATH is None:
        # 使用本地缓存目录
        cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
        model_path = None  # faster-whisper 会自动从 hf hub 下载

        # 可选: 手动指定本地模型路径
        # model_path = "/path/to/your/local/model"

    else:
        model_path = MODEL_PATH

    # 选择推理引擎 - run_on_executor 需要指定
    # availableProviders = ["ctranslate2", "huggingface", "openai"]
    try:
        # 尝试使用 CTranslate2 引擎（最快）
        model = WhisperModel(
            size,
            device="auto",  # 自动选择 CPU/CUDA
            compute_type="int8",  # int8 量化，内存占用小
            download_root=None,  # 模型下载目录
        )
    except Exception as e:
        print(f"⚠️ int8 加载失败，尝试默认类型: {e}")
        model = WhisperModel(size, device="auto")

    current_model_size = size
    print(f"✅ 模型加载完成: {size}")

    return model


def transcribe_audio(audio_data: bytes, language: str = "zh") -> tuple[str, str]:
    """
    识别音频内容

    Args:
        audio_data: 音频数据（wav/mp3等）
        language: 语言代码，zh 为中文

    Returns:
        (原始识别文字, 转换后的简体文字)
    """
    if model is None:
        load_model()

    # 保存到临时文件
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_data)
        temp_path = f.name

    try:
        # 执行识别
        segments, info = model.transcribe(
            temp_path,
            language=language if language != "auto" else None,
            task="transcribe",
            beam_size=5,
            vad_filter=True,  # 启用语音活动检测，过滤静音
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        # 收集所有片段
        full_text = ""
        for segment in segments:
            full_text += segment.text

        # 确保是有效的UTF-8字符串
        raw_text = full_text.strip()
        if isinstance(raw_text, bytes):
            raw_text = raw_text.decode('utf-8', errors='replace')
        simplified_text = to_simplified(raw_text)

        # 记录日志
        log_recognition(len(audio_data), raw_text, simplified_text)

        print(f"🎤 识别结果: {raw_text} → {simplified_text}")
        return raw_text, simplified_text

    finally:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/")
async def root():
    """健康检查"""
    return {
        "status": "ok",
        "service": "本地语音识别服务",
        "model": current_model_size if model else "未加载",
        "whisper_available": WHISPER_AVAILABLE,
        "endpoints": {
            "POST /api/transcribe": "语音识别（发送base64音频）",
            "GET /api/model/{size}": "切换模型 (tiny/base/small/medium/large-v3)",
            "GET /api/status": "服务状态",
        }
    }


@app.get("/api/status")
async def get_status():
    """获取服务状态"""
    return {
        "model_loaded": model is not None,
        "model_size": current_model_size,
        "whisper_available": WHISPER_AVAILABLE,
    }


@app.get("/api/model/{size}")
async def set_model(size: str):
    """切换 Faster-Whisper 模型"""
    if size not in MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的模型尺寸: {size}，可用: {list(MODEL_SIZES.keys())}"
        )

    global model
    model = None  # 强制重新加载
    load_model(size)

    return {"message": f"模型已切换为: {size}", "model_size": size}


@app.post("/api/transcribe")
async def transcribe(request: Request):
    """
    语音识别接口

    请求体:
    {
        "audio": "base64编码的音频数据",
        "language": "zh" (可选，默认中文)
    }

    返回:
    {
        "text": "识别出的文字",
        "language": "zh"
    }
    """
    if not WHISPER_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="faster-whisper 未安装，请运行: pip install faster-whisper"
        )

    try:
        body = await request.json()
        audio_base64 = body.get("audio")
        language = body.get("language", "zh")

        if not audio_base64:
            raise HTTPException(status_code=400, detail="缺少 audio 字段")

        # 解码 base64
        try:
            audio_data = base64.b64decode(audio_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"音频数据格式错误: {e}")

        if len(audio_data) < 1000:
            raise HTTPException(status_code=400, detail="音频数据太短")

        # 延迟加载模型（首次请求时）
        if model is None:
            load_model()

        # 执行识别（返回原始文本和转换后的简体文本）
        raw_text, simplified_text = await asyncio.to_thread(transcribe_audio, audio_data, language)

        return {
            "text": simplified_text,  # 返回简体文本
            "raw_text": raw_text,     # 保留原始识别结果
            "language": language,
            "model": current_model_size,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 识别错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="本地语音识别服务 - Faster-Whisper")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=8765, help="监听端口")
    parser.add_argument("--model", default="base", choices=list(MODEL_SIZES.keys()), help="模型尺寸")
    parser.add_argument("--model-path", default=None, help="本地模型路径（可选）")
    args = parser.parse_args()

    MODEL_PATH = args.model_path

    if not WHISPER_AVAILABLE:
        print("=" * 50)
        print("❌ 错误: faster-whisper 未安装")
        print()
        print("请运行以下命令安装:")
        print("  pip install faster-whisper")
        print()
        print("如果遇到 CTranslate2 相关错误，尝试:")
        print("  pip install ctranslate2")
        print("  pip install faster-whisper")
        print("=" * 50)
        exit(1)

    # 启动时预加载模型
    print("=" * 50)
    print("🦄 本地语音识别服务 - Faster-Whisper")
    print("=" * 50)
    load_model(args.model)

    print(f"""
🚀 服务已启动

📍 地址: http://{args.host}:{args.port}
📝 API 文档: http://{args.host}:{args.port}/docs

📌 使用方法:
   POST /api/transcribe
   Body: {{"audio": "base64音频数据", "language": "zh"}}

🔧 可用模型: {list(MODEL_SIZES.keys())}
   切换模型: GET /api/model/{{size}}

按 Ctrl+C 停止服务
""")

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
