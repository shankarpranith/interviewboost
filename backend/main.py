from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import PyPDF2
import io
from dotenv import load_dotenv

# Import the NEW Google GenAI library
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Switching to 1.5-flash for better free-tier stability
MODEL_ID = "gemini-2.5-flash"
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QAPair(BaseModel):
    question: str
    answer: str

class InterviewRequest(BaseModel):
    role: str
    experience_level: str
    resume_text: Optional[str] = ""
    history: List[QAPair] = []


def handle_gemini_error(e: Exception):
    # 🚨 THIS PRINT STATEMENT IS CRITICAL FOR DEBUGGING 🚨
    print(f"\n🚨 ACTUAL GOOGLE API ERROR: {repr(e)}\n")
    
    error_msg = str(e).lower()
    if "429" in error_msg or "resource_exhausted" in error_msg:
        raise HTTPException(status_code=429, detail="AI Speed Limit Reached! Please wait 20 seconds and click submit again.")
    elif "503" in error_msg or "unavailable" in error_msg:
        raise HTTPException(status_code=503, detail="The AI is currently overloaded. Please try again.")
    raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")


@app.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        text = ""
        for page in pdf_reader.pages:
            if page.extract_text():
                text += page.extract_text() + "\n"
        return {"resume_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to parse PDF resume.")


@app.post("/generate-question")
async def generate_question(req: InterviewRequest):
    try:
        round_num = len(req.history) + 1
        
        history_text = ""
        if req.history:
            for i, qa in enumerate(req.history):
                history_text += f"Round {i+1}:\nInterviewer: {qa.question}\nCandidate: {qa.answer}\n\n"
        else:
            history_text = "No previous questions. This is the start of the interview."

        if round_num == 1:
            stage_instruction = "Ask a strong opening technical question. Focus on core concepts required for this role or ask them to explain a key project from their resume."
        elif round_num == 2:
            stage_instruction = "Analyze the candidate's last answer. Ask a challenging follow-up question that dives deeper into their technical reasoning, or introduce a complex edge-case related to what they just said."
        else:
            stage_instruction = "Ask a high-level system design, architectural, or situational problem-solving question to truly test their capabilities and wrap up the technical assessment."

        prompt = f"""
        You are an expert Senior Technical Interviewer assessing a candidate for a {req.experience_level} {req.role} position.
        
        Candidate's Resume Context:
        {req.resume_text[:1000] if req.resume_text else "None provided."}
        
        Previous Conversation:
        {history_text}
        
        CURRENT STAGE: Round {round_num}.
        YOUR INSTRUCTION FOR THIS ROUND: {stage_instruction}
        
        RULES:
        1. Output ONLY the question text. 
        2. Do NOT say "Great answer" or "Let's move on". Just ask the question directly.
        3. Do NOT repeat previous questions.
        """

        # Fixed: Using the proper ASYNC method for FastAPI
        response = await client.aio.models.generate_content(
            model=MODEL_ID,
            contents=prompt
        )
        return {"question": response.text.strip()}
        
    except Exception as e:
        handle_gemini_error(e)


@app.post("/generate-report")
async def generate_report(req: InterviewRequest):
    try:
        prompt = f"""
        You are an expert Senior Technical Interviewer. The interview for a {req.experience_level} {req.role} position has just concluded.
        
        Interview Transcript:
        """
        for qa in req.history:
            prompt += f"Q: {qa.question}\nA: {qa.answer}\n\n"
            
        prompt += """
        Write a professional, comprehensive feedback report addressing the candidate directly. 
        Format it in clean Markdown with the following sections:
        - **Overall Impression**: A brief summary of their performance.
        - **Key Strengths**: Specific things they answered well.
        - **Areas for Improvement**: Specific technical gaps or better ways they could have answered.
        - **Final Verdict**: A brief concluding thought.
        """

        # Fixed: Using the proper ASYNC method for FastAPI
        response = await client.aio.models.generate_content(
            model=MODEL_ID,
            contents=prompt
        )
        return {"feedback": response.text.strip()}
        
    except Exception as e:
        handle_gemini_error(e)