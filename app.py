import os
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import json # For handling potential JSON errors from Gemini

# Load environment variables (especially API Key)
load_dotenv()

app = Flask(__name__)

# Configure Gemini API
try:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in .env file")
    genai.configure(api_key=api_key)
    # Use gemini-1.5-flash - good balance of speed and capability
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    print("Gemini API configured successfully.")
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    # Exit or handle appropriately if API key is missing/invalid
    exit()

# --- Helper Function for API Calls ---
def generate_gemini_content(prompt, image_data=None):
    """Calls the Gemini API and handles potential errors."""
    try:
        if image_data:
            # Multimodal request (for Objectifier)
            image_part = {"mime_type": image_data.mimetype, "data": image_data.read()}
            response = model.generate_content([prompt, image_part])
        else:
            # Text-only request
            response = model.generate_content(prompt)

        # Handle potential safety blocks or empty responses
        if not response.parts:
             # Try to access candidate information for potential blocking reasons
            try:
                 block_reason = response.candidates[0].finish_reason if response.candidates else "Unknown"
                 safety_ratings = response.candidates[0].safety_ratings if response.candidates else "N/A"
                 print(f"Warning: Gemini response blocked or empty. Reason: {block_reason}, Safety: {safety_ratings}")
                 return f"Error: The response was blocked or empty. Reason: {block_reason}"
            except Exception:
                 print("Warning: Gemini response was empty or structure unexpected.")
                 return "Error: Received an empty or unexpected response from the AI."

        return response.text

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        # Check if the error response from Gemini is JSON
        try:
            error_details = json.loads(str(e))
            if 'message' in error_details:
                return f"Error: Gemini API request failed - {error_details['message']}"
        except json.JSONDecodeError:
            pass # If not JSON, return the standard error string
        return f"Error: An error occurred while contacting the AI: {e}"


# --- Routes ---

@app.route('/')
def index():
    """Renders the main application page."""
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def api_generate():
    """Handles requests for all AI tools."""
    data = request.form # Use request.form for simplicity with JS FormData
    tool = data.get('tool')
    prompt_data = data.get('prompt_data', '{}') # Get other data as JSON string
    image_file = request.files.get('image') # For Objectifier

    try:
        params = json.loads(prompt_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid prompt data format."}), 400

    # --- Build Prompts based on Tool ---
    prompt = ""
    result = ""

    # --- Ada (Chatbot) ---
    if tool == 'ada':
        conversation_history = params.get('history', []) # Expecting a list of {"role": "user/model", "parts": ["text"]}
        user_message = params.get('message', '')
        # Simple history injection (Refine this for better context management)
        full_prompt_parts = []
        for entry in conversation_history:
             full_prompt_parts.append(f"{entry['role'].capitalize()}: {entry['parts'][0]}")
        full_prompt_parts.append(f"User: {user_message}")
        full_prompt_parts.append("Model:") # Ask the model to respond
        prompt = "\n".join(full_prompt_parts)
        # For a more robust chat, use model.start_chat()
        # chat = model.start_chat(history=conversation_history)
        # response = chat.send_message(user_message)
        # result = response.text ... but we'll use the basic generation for now
        result = generate_gemini_content(prompt)

    # --- Taleteller ---
    elif tool == 'taleteller':
        action = params.get('action') # 'new', 'continue', 'end'
        if action == 'new':
            prompt = f"""Create a {params.get('level', 'medium')} level, {params.get('length', 'medium')} length story of the '{params.get('type', 'fantasy')}' genre.
            Setting: {params.get('setting', 'a mysterious forest')}
            Characters: {params.get('characters', 'a brave knight')}
            Start the story now:"""
            result = generate_gemini_content(prompt)
        elif action == 'continue':
            prompt = f"Continue the following story:\n\n{params.get('current_story', '')}\n\nContinue the narrative:"
            result = generate_gemini_content(prompt)
        elif action == 'end':
             prompt = f"Provide a satisfying conclusion to the following story:\n\n{params.get('current_story', '')}\n\nConclude the story:"
             result = generate_gemini_content(prompt)
        else:
             result = "Error: Invalid Taleteller action."


    # --- Dictionary ---
    elif tool == 'dictionary':
        word = params.get('word', '')
        prompt = f"""Provide a detailed dictionary entry for the word or phrase: "{word}"

Include the following sections clearly labeled EXACTLY as shown:
- Pronunciation: [Provide phonetic spelling or IPA here, e.g., /prəˌnʌnsiˈeɪʃən/ or pruh-nuhn-see-AY-shuhn]
- Definitions: [List all common meanings...]
- Synonyms: [...]
- Antonyms: [...]
- Etymology: [...]
- Example Sentences: [...]
- Turkish Meaning: [...]
"""
        result = generate_gemini_content(prompt)

    # --- Text Corrector ---
    elif tool == 'text_corrector':
        text = params.get('text', '')
        prompt = f"""Please correct the following English text for grammar, spelling, punctuation, and style.
        After the corrected text, provide a detailed, bulleted list explaining *each* correction made and why it was necessary.

        Original Text:
        "{text}"

        Corrected Text:
        [Your corrected version here]

        Feedback:
        - [Explanation for correction 1]
        - [Explanation for correction 2]
        ...
        """
        result = generate_gemini_content(prompt)

    # --- Grammar Monster ---
    elif tool == 'grammar_monster':
        topic = params.get('topic', '')
        prompt = f"""Explain the English grammar topic "{topic}" in a comprehensive and easy-to-understand way. Cover all important aspects, rules, exceptions, and provide clear example sentences for each point. Structure the explanation logically with clear headings. Be the 'Grammar Monster' - thorough and detailed!"""
        result = generate_gemini_content(prompt)

    # --- Essayer ---
    elif tool == 'essayer':
        topic = params.get('topic', '')
        essay_type = params.get('type', 'argumentative')
        action = params.get('action') # 'outline' or 'full'

        if action == 'outline':
            prompt = f"Generate a detailed outline for a/an '{essay_type}' essay on the topic: '{topic}'. The outline should include a thesis statement, main points for each body paragraph, and supporting ideas or evidence for each point."
            result = generate_gemini_content(prompt)
        elif action == 'full':
            prompt = f"Write a complete '{essay_type}' essay on the topic: '{topic}'. Ensure it has a clear introduction with a thesis statement, well-developed body paragraphs with supporting details/evidence, and a strong conclusion. Maintain the appropriate tone and structure for this essay type."
            result = generate_gemini_content(prompt)
        else:
             result = "Error: Invalid Essayer action."

    # --- Paraphraser ---
    elif tool == 'paraphraser':
        text = params.get('text', '')
        styles = params.get('styles', ['formal', 'simpler']) # Expecting a list of styles
        prompt = f"""Rephrase the following text into the specified styles. For each style, provide exactly 3 distinct rephrased sentences.

        Original Text:
        "{text}"

        Rephrase into these styles: {', '.join(styles)}

        Format the output clearly for each style:

        **Style: [Style Name 1]**
        1. [Sentence 1]
        2. [Sentence 2]
        3. [Sentence 3]

        **Style: [Style Name 2]**
        1. [Sentence 1]
        2. [Sentence 2]
        3. [Sentence 3]
        ...
        """
        result = generate_gemini_content(prompt)


    # --- Summarizer ---
    elif tool == 'summarizer':
        text = params.get('text', '')
        prompt = f"""Summarize the following text concisely. Identify and present the **main key points in bold**.

        Original Text:
        "{text}"

        Summary:
        [Your summary here with **key points** highlighted]
        """
        result = generate_gemini_content(prompt)

    # --- Transexplainer ---
    elif tool == 'transexplainer':
        text = params.get('text', '')
        source_lang = params.get('source_lang', 'Turkish') # Allow specifying source, default Turkish
        prompt = f"""Translate the following text from {source_lang} into English. After the translation, provide a detailed explanation of the translation process, focusing on tricky phrases, cultural nuances, or grammatical differences addressed.

        Original Text ({source_lang}):
        "{text}"

        English Translation:
        [Your English translation here]

        Explanation of Translation:
        - [Point 1: Explain a specific word choice or grammar structure]
        - [Point 2: Explain another nuance]
        ...
        """
        result = generate_gemini_content(prompt)

    # --- Objectifier ---
    elif tool == 'objectifier':
        if not image_file:
            return jsonify({"error": "No image file provided for Objectifier."}), 400
        prompt = "Analyze this image and identify the main object(s) present. Describe the primary object in detail, including its likely function, appearance, and any notable features."
        result = generate_gemini_content(prompt, image_data=image_file)

    # --- Scenarist ---
    elif tool == 'scenarist':
        character = params.get('character', 'a helpful librarian')
        scenario = params.get('scenario', 'in a quiet library')
        user_message = params.get('message', '')
        conversation_history = params.get('history', []) # Same history format as Ada

        # Construct the initial persona and scenario prompt part (only needed once at start ideally)
        persona_prompt = f"You are now acting as '{character}' {scenario}. Respond to the user's messages strictly in this role. Maintain the persona's likely knowledge, tone, and way of speaking. Do not break character."

        # Build the prompt including persona, history, and new message
        full_prompt_parts = [persona_prompt]
        for entry in conversation_history:
             full_prompt_parts.append(f"{entry['role'].capitalize()}: {entry['parts'][0]}") # Use User/Model for history
        full_prompt_parts.append(f"User: {user_message}")
        full_prompt_parts.append(f"Model ({character}):") # Prompt for response in character
        prompt = "\n".join(full_prompt_parts)

        result = generate_gemini_content(prompt)


         elif tool == 'pros_cons_lister':
        decision_topic = params.get('decision_topic', '').strip()
        if not decision_topic:
            result = "Error: Please enter a topic for the Pros and Cons list."
        else:
            prompt = f"""List the potential pros and cons of "{decision_topic}".
Provide at least 3 pros and 3 cons.
For each pro and con, provide a brief explanation.
Structure your response clearly, for example:

**Pros:**
1.  **[Pro 1 Title/Summary]:** [Brief explanation]
2.  **[Pro 2 Title/Summary]:** [Brief explanation]
3.  **[Pro 3 Title/Summary]:** [Brief explanation]

**Cons:**
1.  **[Con 1 Title/Summary]:** [Brief explanation]
2.  **[Con 2 Title/Summary]:** [Brief explanation]
3.  **[Con 3 Title/Summary]:** [Brief explanation]
"""
            result = generate_gemini_content(prompt)
    # +++ END OF NEW TOOL +++


    else:
        return jsonify({"error": "Invalid tool specified."}), 400

    # Return the result
    # Replace markdown bold/italics etc with HTML tags for easier rendering
    result = result.replace('**', '<b>').replace('**', '</b>') # Basic replacement
    result = result.replace('\n', '<br>') # Replace newlines with <br>

    return jsonify({"result": result})


if __name__ == '__main__':
    # Use 0.0.0.0 to be accessible on the network (needed for Render)
    # Debug=True is helpful during development, but REMOVE for production
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=False) # Use PORT env var for Render
