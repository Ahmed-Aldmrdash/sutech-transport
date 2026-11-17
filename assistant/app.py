from fastapi import FastAPI
from pydantic import BaseModel
import sys
import os
import json
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv

# 1. إعداد المسارات 
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv() # لقراءة الـ API Key من ملف .env

# 2. استدعاء أدوات البحث اللي زميلك جهزها في ملف common
from common import CHUNKS_FILE, INDEX_FILE, embed

# إعداد موديل الذكاء الاصطناعي (Gemini) للرد
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gen_model_name = os.getenv("GEN_MODEL", "gemini-3.5-flash-lite")
model = genai.GenerativeModel(gen_model_name)

app = FastAPI(title="SUTech Transport AI Chatbot")

# 3. تحميل الفهرس والداتا في الذاكرة أول ما السيرفر يشتغل (عشان الرد يكون سريع)
rows = {}
if CHUNKS_FILE.exists():
    for line in CHUNKS_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            rows[r["id"]] = r

if INDEX_FILE.exists():
    idx = np.load(INDEX_FILE)
    vectors = idx["vectors"]
    ids = [str(x) for x in idx["ids"]]
else:
    vectors = []
    ids = []

class ChatRequest(BaseModel):
    question: str

@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    q = request.question.strip()
    
    if len(vectors) == 0:
        return {"status": "error", "response": "ملف الفهرس (Index) مش موجود. تأكد من تشغيل build_index.py أولاً."}
        
    try:
        # --- أ. البحث والتنقيب (المنطق بتاع زميلك) ---
        scores = vectors @ embed([q], "RETRIEVAL_QUERY")[0]
        seen = 0
        shown = set()
        context_texts = []
        
        for i in np.argsort(-scores):
            r = rows[ids[i]]
            if r["chunk_id"] in shown:
                continue
            shown.add(r["chunk_id"])
            
            # تجميع النصوص اللي لاقاها
            context_texts.append(r['text'])
            
            seen += 1
            if seen == 5: # سحب أعلى 5 نتائج لجمع كل التفاصيل
                break
                
        context_str = "\n\n".join(context_texts)
        
        # --- ب. التوليد وصياغة الرد (البرومبت النهائي المحكم) ---
        prompt = f"""أنت المساعد الذكي الرسمي لخدمات النقل بجامعة السويدي للتكنولوجيا (SUTech Transport).
        التزم بالقواعد التالية بدقة:
        1. أجب على سؤال المستخدم بناءً على (المعلومات المتاحة) فقط بأسلوب رسمي، مهذب، ومباشر.
        2. التزم تماماً بلغة سؤال المستخدم: إذا كان السؤال بالإنجليزية، اكتب ردك بالكامل بالإنجليزية (وابدأ بـ Hello)، وإذا كان بالعربية ابدأ بـ "أهلاً بك".
        3. لا تستخدم أي ألقاب عامية أو غير رسمية.
        4. انتبه للمترادفات الجغرافية البديهية في مصر (مثل أن التجمع الخامس هو جزء من القاهرة الجديدة).
        5. إذا كان السؤال يخص النقل ولكن معلومته غير متوفرة في النص، قل أن المعلومة غير متوفرة ووجه الطالب لمكتب النقل (غرفة A039). أما إذا كان السؤال خارج مجال النقل تماماً، فاعتذر فقط بأنك مخصص لخدمات النقل دون توجيهه للمكتب.

        المعلومات المتاحة:
        {context_str}

        سؤال المستخدم: {q}
        """
        
        ai_response = model.generate_content(prompt)
        
        return {
            "status": "success",
            "question": q,
            "response": ai_response.text
        }
        
    except Exception as e:
        return {"status": "error", "response": f"حدث خطأ أثناء المعالجة: {str(e)}"}