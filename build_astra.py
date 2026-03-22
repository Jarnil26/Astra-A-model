import os
import sys
import subprocess
import time

def run_step(name, command):
    print(f"\n>>> [STEP] {name}...")
    start_time = time.time()
    try:
        subprocess.run(command, shell=True, check=True)
        elapsed = time.time() - start_time
        print(f"--- [DONE] {name} in {elapsed:.2f}s ---")
    except subprocess.CalledProcessError as e:
        print(f"!!! [ERROR] {name} failed with exit code {e.returncode} !!!")
        sys.exit(1)

def main():
    print("==================================================")
    print("      Astra A0: Production Pipeline Builder       ")
    print("==================================================")

    # 1. Data Streaming & Indexing (SQL)
    if not os.path.exists("ayurveda_ai.db"):
        run_step("1. Data Streaming to SQLite", "python data_streamer.py")
    else:
        print("[SKIP] SQLite database already exists.")

    # 2. Embedding Generation
    if not os.path.exists("symptom_embeddings.npy"):
        run_step("2. Embedding Generation", "python embedding_builder.py")
    else:
        print("[SKIP] Symptom embeddings already exist.")

    # 3. FAISS Index Building
    if not os.path.exists("ayurveda.index"):
        run_step("3. FAISS Index Building", "python faiss_index_builder.py")
    else:
        print("[SKIP] FAISS index already exists.")

    # 4. Prevalence Matrix Building
    if not os.path.exists("disease_prevalence.json"):
        run_step("4. Auto-Prevalence Builder", "python prevalence_builder.py")
    else:
        print("[SKIP] Disease prevalence matrix already exists.")

    print("\n==================================================")
    print("  ASTRA A0 MODEL IS NOW PRODUCTION READY!        ")
    print("==================================================")
    print("Run 'python main.py' to start the reasoning engine.")

if __name__ == "__main__":
    main()
