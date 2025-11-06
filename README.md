# 🤖 Robust Audio-Visual Speech Recognition (AV-ASR) Web Application

This repository contains the complete source code and assets for a full-stack web application that performs robust speech recognition by integrating both **audio and visual (lip movement) cues** from a video file. The core model architecture is inspired by **AV-HuBERT**.

---

## 🎯 Project Goal

The primary goal of this project was to deploy a user-friendly, scalable web app capable of transcribing speech from video files. This was specifically designed to **overcome the limitations of standard ASR (audio-only speech recognition) in noisy environments** such as crowds, music, and wind.

---

## 💻 System Architecture Overview 

The application utilizes a **dual-stream architecture** for multimodal processing and is split into two deployable services:

* **Frontend (UI):** Built with **React** and **TypeScript**, styled with **Tailwind CSS**, and bundled with **Vite**. Deployed on **Vercel**.
* **Backend (Inference Engine):** Built with **Python** and **Flask**, utilizing **PyTorch** for model inference, and **OpenCV** and **PyAV** for pre-processing. Served by **gunicorn** and deployed on **Hugging Face Spaces**.

### Core Model & Reference

* **Model Goal:** Enabling accurate video transcription in noisy environments through audio-visual integration.
* **AV-HuBERT Reference Repository:** The foundational research repository is provided for context and reference.

---

## 🛠️ Setup and Execution Instructions

### Prerequisites

You must have the following installed on your local machine to run the backend and frontend development environments:

* **Python (3.9+ recommended)**
* **Node.js (LTS)**
* **FFmpeg (System-Wide Installation):** Crucial for video/audio processing. Ensure the **shared libraries** for a compatible version (7.x or 8.x) are installed and added to your system's PATH.

### 1. Backend Setup (API Service)

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/](https://github.com/)[Your_GitHub_Username]/[Your_Repo_Name].git
    cd [Your_Repo_Name]
    ```
2.  **Create and activate the virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # macOS/Linux
    .\venv\Scripts\activate    # Windows PowerShell
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Place Artifacts:** Ensure the following files are in the repository root directory:
    * `best_model.pt` (Trained PyTorch model weights)
    * `vocabulary.json` (Word-to-index mapping)
5.  **Run the FastAPI/Flask server:**
    ```bash
    uvicorn app:app --reload
    ```

### 2. Frontend Setup (React App)

1.  **Navigate to the frontend directory (e.g., `src/`):**
    ```bash
    cd src/
    ```
2.  **Install Node dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    npm run dev
    ```

---

## 📚 Repository Contents

| File/Asset | Description |
| :--- | :--- |
| **Source Code** | All application source code (`app.py`, components, etc.) |
| **`requirements.txt`** | Complete list of Python dependencies (PyTorch, Whisper, Flask, etc.) |
| **`best_model.pt`** | The trained Audio-Visual model weights |
| **Dataset/`** | Link to the **GRID Dataset** used for training. |
| **`README.md`** | This document, with setup and execution instructions. |

---

## 🔗 Links

| Resource | URL |
| :--- | :--- |
| **Source Code Repository** | https://github.com/gunavardhanyakkati/Gen_AI_mock_interview_milestone_ |
| **Dataset Used (GRID)** | `https://spandh.dcs.shef.ac.uk/gridcorpus/`  |
| **AV-HuBERT Reference** | `https://github.com/facebookresearch/av_hubert` |
| **Presentation/Project Summary** | https://docs.google.com/presentation/d/1MNv4g6Q2eN22RrohnCM78_fnFEOZIvLb/edit?usp=sharing&ouid=115753322327986944310&rtpof=true&sd=true |


---

## 🤝 Contact

For questions or issues, please open an issue in this repository.
