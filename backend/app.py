from flask import Flask, render_template, request, jsonify
from openai import AzureOpenAI, APIError, APIConnectionError, APITimeoutError, RateLimitError, AuthenticationError
import requests
import os
import markdown
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# In-memory cache for regeneration and versioning
last_inputs = {}

# Load summaries into local JSON for versioning
SAVE_FILE = "review_history.json"
def save_summary(pr_url, summary):
    entry = {
        "url": pr_url,
        "summary": summary,
        "timestamp": datetime.now().isoformat()
    }
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r") as f:
            data = json.load(f)
    else:
        data = []
    data.append(entry)
    with open(SAVE_FILE, "w") as f:
        json.dump(data, f, indent=2)

def extract_github_diff(pr_url):
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Authorization": f"token {token}"} if token else {}

    if "/pull/" in pr_url:
        parts = pr_url.split("/pull/")
        repo = parts[0].replace("https://github.com/", "")
        pr_number = parts[1].split("/")[0]
        url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch PR metadata: {response.text}")
        diff_url = response.json().get("diff_url")
    elif "/commit/" in pr_url:
        parts = pr_url.split("/commit/")
        repo = parts[0].replace("https://github.com/", "")
        sha = parts[1].split("/")[0]
        diff_url = f"https://github.com/{repo}/commit/{sha}.diff"
    else:
        raise ValueError("Invalid GitHub URL format.")

    diff_response = requests.get(diff_url, headers=headers)
    if diff_response.status_code != 200:
        raise Exception(f"Failed to fetch diff: {diff_response.text}")

    return diff_response.text

def generate_review_prompt(diff_text, tone="senior dev", persona="strict reviewer"):
    return f"""
You are a code reviewer acting as a {tone} in the role of a {persona}.

Analyze the following GitHub diff. Your output must be in markdown and follow this format:

### Summary

### Risks / Issues

### Suggested Improvements

### Unit Test Suggestions
(Use pytest style)

### Bug Prediction

### Code Quality Score (1–10)

---

GitHub Diff:
{diff_text}
"""

def validate_azure_openai_config():
    """Validate Azure OpenAI configuration and return detailed error if any"""
    missing = []
    if not os.environ.get("AZURE_OPENAI_API_KEY"):
        missing.append("AZURE_OPENAI_API_KEY")
    if not os.environ.get("AZURE_OPENAI_ENDPOINT"):
        missing.append("AZURE_OPENAI_ENDPOINT")
    if not os.environ.get("AZURE_OPENAI_DEPLOYMENT"):
        missing.append("AZURE_OPENAI_DEPLOYMENT")
    
    if missing:
        return f"Missing required Azure OpenAI configuration: {', '.join(missing)}"
    return None

def get_azure_openai_client():
    """Get Azure OpenAI client with error handling"""
    error = validate_azure_openai_config()
    if error:
        raise ValueError(error)
        
    try:
        client = AzureOpenAI(
            api_key=os.environ.get("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        return client
    except Exception as e:
        raise ValueError(f"Failed to initialize Azure OpenAI client: {str(e)}")

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        pr_url = request.form.get("pr_url")
        file_content = request.form.get("file_content")
        tone = request.form.get("tone", "senior dev")
        persona = request.form.get("persona", "strict reviewer")

        try:
            if pr_url:
                diff = extract_github_diff(pr_url)
            elif file_content:
                diff = file_content
            else:
                return render_template("index.html", response_html="❌ Error: No input provided.")

            if len(diff.strip()) < 20:
                return render_template("index.html", response_html="Diff too small to analyze.")

            if len(diff) > 14000:
                return render_template("index.html", response_html="Diff too large to analyze. Please reduce file size or limit changes.")

            # Get Azure OpenAI client with validation
            try:
                client = get_azure_openai_client()
            except ValueError as e:
                return render_template("index.html", response_html=f"<p style='color:red;'>❌ Configuration Error: {str(e)}</p>")

            prompt = generate_review_prompt(diff, tone=tone, persona=persona)
            
            try:
                response = client.chat.completions.create(
                    model=os.environ.get("AZURE_OPENAI_DEPLOYMENT"),
                    messages=[
                        {"role": "system", "content": "You are a code reviewer."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=2048
                )
                ai_text = response.choices[0].message.content
                html_output = markdown.markdown(ai_text)

                last_inputs["prompt"] = prompt
                last_inputs["url"] = pr_url or "Local Diff"
                last_inputs["html"] = html_output

                save_summary(pr_url or "Local Diff", ai_text)

                return render_template("index.html", response_html=html_output)

            except AuthenticationError as e:
                return render_template("index.html", response_html=f"<p style='color:red;'>❌ Authentication Error: Invalid API key or not authorized. Please check your AZURE_OPENAI_API_KEY.</p>")
            except RateLimitError as e:
                return render_template("index.html", response_html=f"<p style='color:red;'>❌ Rate Limit Error: Too many requests. Please try again later.</p>")
            except APITimeoutError as e:
                return render_template("index.html", response_html=f"<p style='color:red;'>❌ Timeout Error: Request took too long. Please try again.</p>")
            except APIConnectionError as e:
                return render_template("index.html", response_html=f"<p style='color:red;'>❌ Connection Error: Could not connect to Azure OpenAI. Please check your internet connection and AZURE_OPENAI_ENDPOINT.</p>")
            except APIError as e:
                error_message = str(e)
                if "DeploymentNotFound" in error_message:
                    return render_template("index.html", response_html=f"<p style='color:red;'>❌ Deployment Error: The specified deployment '{os.environ.get('AZURE_OPENAI_DEPLOYMENT')}' was not found. Please check your AZURE_OPENAI_DEPLOYMENT value.</p>")
                return render_template("index.html", response_html=f"<p style='color:red;'>❌ API Error: {error_message}</p>")

        except Exception as e:
            return render_template("index.html", response_html=f"<p style='color:red;'>❌ Error: {str(e)}</p>")

    return render_template("index.html")

@app.route("/regenerate", methods=["POST"])
def regenerate():
    try:
        if not last_inputs.get("prompt"):
            return jsonify({"error": "Nothing to regenerate."}), 400
            
        try:
            client = get_azure_openai_client()
        except ValueError as e:
            return jsonify({"error": f"Configuration Error: {str(e)}"}), 500

        try:
            response = client.chat.completions.create(
                model=os.environ.get("AZURE_OPENAI_DEPLOYMENT"),
                messages=[
                    {"role": "system", "content": "You are a code reviewer."},
                    {"role": "user", "content": last_inputs["prompt"]}
                ],
                temperature=0.2,
                max_tokens=2048
            )
            ai_text = response.choices[0].message.content
            html_output = markdown.markdown(ai_text)
            save_summary(last_inputs.get("url"), ai_text)
            return jsonify({"html": html_output})

        except AuthenticationError:
            return jsonify({"error": "Authentication Error: Invalid API key or not authorized. Please check your AZURE_OPENAI_API_KEY."}), 401
        except RateLimitError:
            return jsonify({"error": "Rate Limit Error: Too many requests. Please try again later."}), 429
        except APITimeoutError:
            return jsonify({"error": "Timeout Error: Request took too long. Please try again."}), 504
        except APIConnectionError:
            return jsonify({"error": "Connection Error: Could not connect to Azure OpenAI. Please check your internet connection and AZURE_OPENAI_ENDPOINT."}), 503
        except APIError as e:
            error_message = str(e)
            if "DeploymentNotFound" in error_message:
                return jsonify({"error": f"Deployment Error: The specified deployment '{os.environ.get('AZURE_OPENAI_DEPLOYMENT')}' was not found. Please check your AZURE_OPENAI_DEPLOYMENT value."}), 404
            return jsonify({"error": f"API Error: {error_message}"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/token-check", methods=["GET"])
def check_tokens():
    # Validate Azure OpenAI configuration
    azure_error = validate_azure_openai_config()
    azure_ok = azure_error is None
    
    # Check GitHub token
    github_ok = os.environ.get("GITHUB_TOKEN") is not None
    
    return jsonify({
        "azure_openai": azure_ok,
        "azure_error": azure_error if not azure_ok else None,
        "github": github_ok
    })

if __name__ == "__main__":
    app.run(debug=True)
