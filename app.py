
import os
from flask import Flask, request, render_template
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-pro")

app = Flask(__name__)

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        code_diff = request.form["diff"]
        prompt = f"""
You are an AI assistant that helps developers review GitHub pull requests.

Given the following code diff, generate:
1. A short summary of what the pull request changes.
2. A list of potential issues or considerations.
3. Suggested unit tests based on the new code.

Diff:
{code_diff}
"""
        response = model.generate_content(prompt)
        return render_template("index.html", response=response.text)
    return render_template("index.html", response=None)

if __name__ == "__main__":
    app.run(debug=True)
