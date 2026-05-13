# FANCAS Assessment App

แอป Nursing Daily Care Plan ที่เชื่อมกับ Dify workflow สำหรับสร้าง Problem List for IPD อัตโนมัติ

## โครงสร้าง

```
fancas-app/
├── index.html           # Form UI (FANCAS checkboxes)
├── api/
│   └── dify.js          # Serverless function — proxy to Dify (เก็บ API key)
├── package.json         # Node.js config
├── .gitignore           # ป้องกัน commit ไฟล์ลับ
├── .env.local.example   # Template สำหรับ env vars
└── README.md
```

**Architecture:**

```
[Nurse] → [index.html on Vercel] → [/api/dify proxy] → [Dify workflow]
                ↑                          ↑
        no API key here          API key from env var
```

---

## วิธี Deploy ขึ้น Vercel (แนะนำ — ฟรี)

### ทางที่ 1: ผ่าน GitHub (ง่ายที่สุด)

1. **สร้าง GitHub repo ใหม่** แล้ว upload ไฟล์ทั้งหมดในโฟลเดอร์นี้
   - ⚠️ ห้าม commit `.env.local` (มีในไฟล์ `.gitignore` แล้ว)

2. **ไปที่** [vercel.com](https://vercel.com) → Sign up ด้วย GitHub

3. **คลิก "Add New Project"** → Import repo ที่เพิ่งสร้าง

4. **ก่อนกด Deploy** ไปที่ "Environment Variables":
   - Name: `DIFY_API_KEY`
   - Value: `app-i3A2cxWnLfQYn6EfPWOmuSCv` (ของคุณ)
   - กด "Add"

5. **กด Deploy** — รอประมาณ 30 วินาที

6. ได้ URL เช่น `fancas-app-xxxx.vercel.app` — เปิดใช้งานได้ทันที

### ทางที่ 2: ผ่าน Vercel CLI

```bash
# ติดตั้ง Vercel CLI ครั้งเดียว
npm install -g vercel

# เข้าโฟลเดอร์ project
cd fancas-app

# Login
vercel login

# Deploy (ตอบคำถามตามที่ขึ้น)
vercel

# ตั้ง environment variable
vercel env add DIFY_API_KEY
# วาง app-i3A2cxWnLfQYn6EfPWOmuSCv เมื่อขึ้นถาม

# Deploy production
vercel --prod
```

---

## ทดสอบบน Local (ก่อน deploy)

```bash
# ติดตั้ง Vercel CLI
npm install -g vercel

# Copy env template
cp .env.local.example .env.local
# แก้ DIFY_API_KEY ใน .env.local ให้ถูก

# รัน dev server
vercel dev

# เปิด browser ไปที่ http://localhost:3000
```

---

## ทางเลือกอื่นๆ ถ้าไม่ใช้ Vercel

### Cloudflare Pages + Workers (ฟรีเช่นกัน)
- Logic เดียวกัน แต่ไฟล์ `/api/dify.js` ต้องเขียนเป็น Cloudflare Worker syntax

### Self-host ด้วย Python Flask
- เหมาะถ้าต้องการ host ใน intranet ของโรงพยาบาล
- สร้างไฟล์ `server.py`:

```python
from flask import Flask, request, send_from_directory, jsonify
import os, requests

app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/dify', methods=['POST'])
def dify_proxy():
    api_key = os.environ.get('DIFY_API_KEY')
    if not api_key:
        return jsonify({"error": "DIFY_API_KEY not set"}), 500
    
    endpoint = os.environ.get('DIFY_ENDPOINT', 'https://api.dify.ai/v1/workflows/run')
    r = requests.post(
        endpoint,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        json=request.json
    )
    return jsonify(r.json()), r.status_code

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
```

รันด้วย:
```bash
pip install flask requests
export DIFY_API_KEY=app-i3A2cxWnLfQYn6EfPWOmuSCv
python server.py
```

เปิด `http://localhost:8000`

### Docker (สำหรับ deploy production)
ใช้ Flask + Gunicorn + Nginx → build Docker image → deploy บน VPS

---

## Workflow Configuration ที่ต้องตรงกับฝั่ง Dify

ใน Dify workflow ของคุณ:
1. **Publish** ก่อน — กดปุ่ม Publish ที่มุมขวาบนของ Studio
2. ตรวจสอบว่า **Input variable** ใน Start node ชื่อ `fancas_assessment` (ถ้าตั้งชื่ออื่น ต้องแก้ใน `index.html` ตรง `inputs: { fancas_assessment: assessment }`)
3. ตรวจสอบว่า **End node** มี output ชื่อ `problem_list` กับ `summary` (ถ้าต่าง ต้องแก้ใน `displayResult()` ของ `index.html`)

---

## Security Checklist

- [x] API key ไม่อยู่ใน frontend HTML
- [x] API key อยู่ใน Vercel env var (encrypted at rest)
- [x] `.env.local` ถูก `.gitignore` ป้องกัน
- [ ] ถ้าใช้กับข้อมูลผู้ป่วยจริง → เพิ่ม authentication (NextAuth/Clerk/SSO)
- [ ] เพิ่ม rate limiting ใน `/api/dify` ป้องกัน abuse
- [ ] บันทึก audit log (user, timestamp, request, response)
- [ ] ตรวจสอบ PDPA / นโยบายข้อมูลโรงพยาบาลก่อน production

---

## Troubleshooting

**Error: "DIFY_API_KEY environment variable not set"**
→ ไป Vercel Dashboard → Project → Settings → Environment Variables → เพิ่ม `DIFY_API_KEY`

**Error: HTTP 401 / 403**
→ ตรวจ API key ว่าถูกต้อง และ workflow ใน Dify ได้กด Publish แล้วหรือยัง

**Error: HTTP 404**
→ Workflow ยังไม่ Publish หรือ endpoint URL ใน `api/dify.js` ผิด

**Frontend ไม่เรียก `/api/dify`**
→ เช็คว่า deploy บน Vercel แล้ว (local file:// จะไม่มี backend route)
