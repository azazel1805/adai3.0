document.addEventListener('DOMContentLoaded', () => {
    const toolNav = document.getElementById('tool-nav');
    const toolSections = document.querySelectorAll('.tool-section');
    const mainContent = document.getElementById('main-content');
    const apiEndpoint = '/api/generate'; // Flask API endpoint

    // --- Tool Switching Logic ---
    toolNav.addEventListener('click', (event) => {
        if (event.target.classList.contains('nav-button')) {
            const targetTool = event.target.dataset.tool;

            // Update active button
            toolNav.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // Show/Hide sections
            toolSections.forEach(section => {
                if (section.id === `${targetTool}-tool`) {
                    section.style.display = 'block';
                } else {
                    section.style.display = 'none';
                }
            });
            // Special case for home
             if (targetTool === 'home') {
                 document.getElementById('home-tool').style.display = 'block';
             } else {
                 document.getElementById('home-tool').style.display = 'none';
             }
        }
    });

    // --- Helper Function for API Calls ---
    async function callApi(toolName, promptData = {}, imageFile = null) {
        const thinkingIndicator = document.getElementById(`${toolName}-thinking`);
        const outputArea = document.getElementById(`${toolName}-output`); // Standard output area
        const submitButton = document.querySelector(`#${toolName}-tool button[id$="-btn"]`); // Find primary button

        if (thinkingIndicator) thinkingIndicator.style.display = 'block';
        if (outputArea) outputArea.innerHTML = ''; // Clear previous output
        if (submitButton) submitButton.disabled = true; // Disable button during call

        const formData = new FormData();
        formData.append('tool', toolName);
        // Send prompt data as a JSON string because FormData only handles strings or Blobs easily
        formData.append('prompt_data', JSON.stringify(promptData));

        if (imageFile) {
            formData.append('image', imageFile); // Add image file if present
        }

        let resultHtml = 'Error: Could not contact the server.'; // Default error

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                body: formData // Send as FormData
                // No 'Content-Type' header needed; browser sets it for FormData
            });

            if (!response.ok) {
                 // Try to get error message from JSON response
                 let errorMsg = `Error: ${response.status} ${response.statusText}`;
                 try {
                     const errorJson = await response.json();
                     if (errorJson.error) {
                         errorMsg = `Error: ${errorJson.error}`;
                     }
                 } catch (e) { /* Ignore if response is not JSON */ }
                 throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data.error) {
                resultHtml = `<p style="color: red;">${data.error}</p>`;
            } else {
                resultHtml = data.result; // The result HTML comes pre-formatted from Flask
            }

        } catch (error) {
            console.error(`API Call Error (${toolName}):`, error);
            resultHtml = `<p style="color: red;">${error.message || 'An unexpected error occurred.'}</p>`;
        } finally {
            if (thinkingIndicator) thinkingIndicator.style.display = 'none';
            if (outputArea) {
                outputArea.innerHTML = resultHtml; // Display result or error
                outputArea.scrollTop = outputArea.scrollHeight; // Scroll to bottom if needed
            }
             // Specific handling for chat interfaces
            if (toolName === 'ada' || toolName === 'scenarist') {
                // Chat outputs are handled separately below
            } else if (outputArea) {
                 outputArea.innerHTML = resultHtml;
            }

            if (submitButton) submitButton.disabled = false; // Re-enable button
        }
        return resultHtml; // Return the result in case it's needed elsewhere
    }

     // --- Helper to add messages to chat UI ---
    function addChatMessage(toolPrefix, sender, message) {
        const historyDiv = document.getElementById(`${toolPrefix}-chat-history`);
        if (!historyDiv) return;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'model-message');
        // Basic sanitization (replace < and > to prevent HTML injection)
        // For production, use a proper sanitization library if needed.
        const sanitizedMessage = message.replace(/</g, "<").replace(/>/g, ">");
        messageDiv.innerHTML = sanitizedMessage; // Use innerHTML because Flask might send <br>, <b> etc.
        historyDiv.appendChild(messageDiv);
        historyDiv.scrollTop = historyDiv.scrollHeight; // Scroll to the bottom
    }

    // --- Tool-Specific Event Listeners ---

    // --- Ada Chatbot ---
    const adaInput = document.getElementById('ada-input');
    const adaSendBtn = document.getElementById('ada-send-btn');
    const adaMicBtn = document.getElementById('ada-mic-btn'); // Assuming speech.js handles this
    const adaMuteBtn = document.getElementById('ada-mute-btn'); // Assuming speech.js handles this
    let adaConversationHistory = []; // Store history {role: 'user'/'model', parts: ['text']}

    async function sendAdaMessage() {
         const message = adaInput.value.trim();
         if (!message) return;

         addChatMessage('ada', 'user', message);
         adaInput.value = ''; // Clear input
         adaConversationHistory.push({ role: 'user', parts: [message] });

         const thinkingIndicator = document.getElementById('ada-thinking');
         const outputArea = document.getElementById('ada-chat-history'); // Target the history div
         adaSendBtn.disabled = true;
         if (thinkingIndicator) thinkingIndicator.style.display = 'block';

         // Prepare data for API
         const promptData = {
             history: adaConversationHistory,
             message: message
         };

         // Call API (similar structure to callApi, but handles chat history directly)
        const formData = new FormData();
        formData.append('tool', 'ada');
        formData.append('prompt_data', JSON.stringify(promptData));

        let resultHtml = 'Error: Could not contact the server.'; // Default error

        try {
            const response = await fetch(apiEndpoint, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.error) {
                 resultHtml = `<p style="color: red;">${data.error}</p>`;
                 addChatMessage('ada', 'model', data.error); // Show error in chat
                 adaConversationHistory.push({ role: 'model', parts: [data.error] }); // Add error to history? Maybe not.
            } else {
                 resultHtml = data.result; // Raw result from API
                 addChatMessage('ada', 'model', resultHtml); // Add model response to chat
                 adaConversationHistory.push({ role: 'model', parts: [resultHtml] }); // Add response to history

                 // --- Optional: Speech Synthesis ---
                 if (window.speechSynthesis && window.isAdaSpeechEnabled) { // Check flag from speech.js
                    speakText(resultHtml); // Function defined in speech.js
                 }
                 // --- End Speech Synthesis ---
            }

        } catch (error) {
             console.error(`API Call Error (Ada):`, error);
             resultHtml = `<p style="color: red;">${error.message || 'An unexpected error occurred.'}</p>`;
             addChatMessage('ada', 'model', error.message || 'An unexpected error occurred.');
        } finally {
             if (thinkingIndicator) thinkingIndicator.style.display = 'none';
             adaSendBtn.disabled = false;
             // Keep history length reasonable (e.g., last 10 messages total)
             if (adaConversationHistory.length > 10) {
                 adaConversationHistory = adaConversationHistory.slice(-10);
             }
         }
    }
    adaSendBtn.addEventListener('click', sendAdaMessage);
    adaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline in textarea
            sendAdaMessage();
        }
    });

    // --- Taleteller ---
    const taletellerGenerateBtn = document.getElementById('taleteller-generate-btn');
    const taletellerContinueBtn = document.getElementById('taleteller-continue-btn');
    const taletellerEndBtn = document.getElementById('taleteller-end-btn');
    const taletellerOutput = document.getElementById('taleteller-output');
    let currentStory = ''; // Store the current story

    taletellerGenerateBtn.addEventListener('click', async () => {
        const promptData = {
            action: 'new',
            characters: document.getElementById('taleteller-chars').value,
            type: document.getElementById('taleteller-type').value,
            setting: document.getElementById('taleteller-setting').value,
            length: document.getElementById('taleteller-length').value,
            level: document.getElementById('taleteller-level').value,
        };
        currentStory = await callApi('taleteller', promptData); // Store the result
        if (!currentStory.startsWith('<p style="color: red;">')) { // Only show buttons if successful
             taletellerContinueBtn.style.display = 'inline-block';
             taletellerEndBtn.style.display = 'inline-block';
        } else {
             taletellerContinueBtn.style.display = 'none';
             taletellerEndBtn.style.display = 'none';
        }
    });

    taletellerContinueBtn.addEventListener('click', async () => {
         if (!currentStory) return;
         const promptData = { action: 'continue', current_story: currentStory };
         const continuation = await callApi('taleteller', promptData);
         if (!continuation.startsWith('<p style="color: red;">')) {
             currentStory += "<br><br>" + continuation; // Append continuation
             taletellerOutput.innerHTML = currentStory; // Update output area directly
         } else {
              taletellerOutput.innerHTML += '<br><br>' + continuation; // Show error after story
         }

    });
     taletellerEndBtn.addEventListener('click', async () => {
         if (!currentStory) return;
         const promptData = { action: 'end', current_story: currentStory };
         const conclusion = await callApi('taleteller', promptData);
         if (!conclusion.startsWith('<p style="color: red;">')) {
             currentStory += "<br><br><b>--- THE END ---</b><br>" + conclusion; // Append conclusion
             taletellerOutput.innerHTML = currentStory; // Update output area directly
             taletellerContinueBtn.style.display = 'none'; // Hide buttons after ending
             taletellerEndBtn.style.display = 'none';
         } else {
              taletellerOutput.innerHTML += '<br><br>' + conclusion; // Show error after story
         }
    });

    // --- Dictionary ---
    // Get references to the DOM elements for the Dictionary tool
    const dictionaryLookupBtn = document.getElementById('dictionary-lookup-btn');
    const dictionaryWordInput = document.getElementById('dictionary-word');
    const dictionaryOutputArea = document.getElementById('dictionary-output');
    const dictionaryPronounceBtn = document.getElementById('dictionary-pronounce-btn'); // Reference to the pronunciation button
    const dictionaryThinking = document.getElementById('dictionary-thinking'); // Reference to the thinking indicator

    // Add event listener for the main 'Lookup' button click
    dictionaryLookupBtn.addEventListener('click', async () => { // Make the handler asynchronous to use await
        const word = dictionaryWordInput.value.trim(); // Get the word from the input field
        if (!word) return; // Do nothing if the input is empty

        // --- Reset UI State Before API Call ---
        dictionaryOutputArea.innerHTML = ''; // Clear previous results
        dictionaryPronounceBtn.style.display = 'none'; // Hide the pronunciation button initially
        dictionaryPronounceBtn.disabled = true;        // Disable it
        dictionaryPronounceBtn.dataset.pronunciation = ''; // Clear any previously stored pronunciation text
        if (dictionaryThinking) dictionaryThinking.style.display = 'block'; // Show the thinking indicator
        dictionaryLookupBtn.disabled = true; // Disable the lookup button during the request

        try {
            // Call the backend API using the helper function 'callApi'
            // Pass the tool name 'dictionary' and the word in the promptData object
            // 'await' pauses execution until the API call completes and returns the result
            const resultHtml = await callApi('dictionary', { word: word });

            // Display the full result HTML received from the backend API
            dictionaryOutputArea.innerHTML = resultHtml;

            // --- Attempt to Extract Pronunciation from the Result ---
            let pronunciationText = ''; // Variable to store the extracted pronunciation
            // Create a temporary, in-memory div element to safely parse the HTML result
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = resultHtml; // Put the API result HTML into the temporary div

            // Get the text content and split it into lines for easier searching
            const lines = tempDiv.innerText.split('\n');
            // Loop through each line of the text content
            for (const line of lines) {
                const cleanedLine = line.trim(); // Remove leading/trailing whitespace
                // Check if the line starts with "Pronunciation:" (case-insensitive)
                if (cleanedLine.toLowerCase().startsWith('pronunciation:')) {
                    // Extract the text after "Pronunciation:"
                    pronunciationText = cleanedLine.substring('pronunciation:'.length).trim();
                    // Further clean-up: Remove common parenthetical explanations like (IPA: ...) or similar using RegEx
                    pronunciationText = pronunciationText.replace(/\([\s\S]*?\)/g, '').trim();
                    // Remove leading/trailing characters like slashes often found in phonetic notations
                    pronunciationText = pronunciationText.replace(/^[/\\|]|[/\\|]$/g, '').trim();
                    // Optional: Remove any extra colons or dashes at the beginning if Gemini adds them
                    pronunciationText = pronunciationText.replace(/^[:\-]\s*/, '').trim();
                    break; // Stop searching once the pronunciation line is found
                }
            }
            // --- End Pronunciation Extraction ---

            // Check if pronunciation text was found AND the speakText function is available (from speech.js)
            if (pronunciationText && typeof speakText === 'function') {
                console.log("Extracted Pronunciation:", pronunciationText);
                // Store the extracted text in the button's data attribute for later use
                dictionaryPronounceBtn.dataset.pronunciation = pronunciationText;
                dictionaryPronounceBtn.style.display = 'inline-block'; // Make the pronunciation button visible
                dictionaryPronounceBtn.disabled = false; // Enable the pronunciation button
            } else {
                // Log if pronunciation wasn't found or speech synthesis isn't supported/available
                console.log("Pronunciation text not found in result or speakText function unavailable.");
                dictionaryPronounceBtn.style.display = 'none'; // Ensure the button remains hidden
            }

        } catch (error) {
            // Log any errors during the API call or processing
            // Note: The callApi function should already display the error in the output area
            console.error("Dictionary lookup process failed:", error);
            // Ensure the pronunciation button remains hidden if an error occurred
            dictionaryPronounceBtn.style.display = 'none';
        } finally {
            // --- Final UI State Update (runs whether successful or not) ---
            if (dictionaryThinking) dictionaryThinking.style.display = 'none'; // Hide the thinking indicator
            dictionaryLookupBtn.disabled = false; // Re-enable the lookup button
        }
    });

    // Add event listener to the input field to trigger lookup on 'Enter' key press
    dictionaryWordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent default form submission or newline behavior
            dictionaryLookupBtn.click(); // Programmatically click the lookup button
        }
    });

    // Add event listener for the pronunciation button click
    dictionaryPronounceBtn.addEventListener('click', () => {
        // Retrieve the stored pronunciation text from the button's data attribute
        const textToSpeak = dictionaryPronounceBtn.dataset.pronunciation;
        // Check if there's text to speak and the speakText function is available
        if (textToSpeak && typeof speakText === 'function') {
            console.log("Speaking pronunciation:", textToSpeak);
            speakText(textToSpeak); // Call the speech synthesis function (defined in speech.js)
        } else {
            console.warn("No pronunciation data available to speak or speech function missing.");
            // Optional: Provide user feedback if needed, e.g., briefly disable/change button appearance
        }
    });
    // --- End Dictionary Tool Section --

    // --- Text Corrector ---
    document.getElementById('text_corrector-submit-btn').addEventListener('click', () => {
        const text = document.getElementById('text_corrector-input').value;
        if (!text) return;
        callApi('text_corrector', { text: text });
    });

    // --- Grammar Monster ---
    document.getElementById('grammar_monster-explain-btn').addEventListener('click', () => {
        const topic = document.getElementById('grammar_monster-topic').value;
        if (!topic) return;
        callApi('grammar_monster', { topic: topic });
    });
     document.getElementById('grammar_monster-topic').addEventListener('keypress', (e) => {
         if (e.key === 'Enter') {
              document.getElementById('grammar_monster-explain-btn').click();
         }
     });

    // --- Essayer ---
    document.getElementById('essayer-outline-btn').addEventListener('click', () => {
        const topic = document.getElementById('essayer-topic').value;
        const type = document.getElementById('essayer-type').value;
        if (!topic) return;
        callApi('essayer', { topic: topic, type: type, action: 'outline' });
    });
    document.getElementById('essayer-full-btn').addEventListener('click', () => {
        const topic = document.getElementById('essayer-topic').value;
        const type = document.getElementById('essayer-type').value;
        if (!topic) return;
        callApi('essayer', { topic: topic, type: type, action: 'full' });
    });

    // --- Paraphraser ---
    document.getElementById('paraphraser-submit-btn').addEventListener('click', () => {
        const text = document.getElementById('paraphraser-input').value;
        const selectedStyles = Array.from(document.querySelectorAll('input[name="paraphraser-style"]:checked'))
                                    .map(cb => cb.value);
        if (!text || selectedStyles.length === 0) return;
        callApi('paraphraser', { text: text, styles: selectedStyles });
    });

    // --- Summarizer ---
    document.getElementById('summarizer-submit-btn').addEventListener('click', () => {
        const text = document.getElementById('summarizer-input').value;
        if (!text) return;
        callApi('summarizer', { text: text });
    });

    // --- Transexplainer ---
    document.getElementById('transexplainer-submit-btn').addEventListener('click', () => {
        const text = document.getElementById('transexplainer-input').value;
        let sourceLang = document.getElementById('transexplainer-lang').value.trim();
        if (!sourceLang) sourceLang = 'Turkish'; // Default if empty
        if (!text) return;
        callApi('transexplainer', { text: text, source_lang: sourceLang });
    });

    // --- Objectifier ---
    const objectifierFileInput = document.getElementById('objectifier-file');
    const objectifierPreview = document.getElementById('objectifier-preview');
    const objectifierSubmitBtn = document.getElementById('objectifier-submit-btn');

    objectifierFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                objectifierPreview.innerHTML = `<img src="${e.target.result}" alt="Image preview">`;
            }
            reader.readAsDataURL(file);
            objectifierSubmitBtn.disabled = false;
        } else {
             objectifierPreview.innerHTML = '';
             objectifierSubmitBtn.disabled = true;
        }
    });

    objectifierSubmitBtn.addEventListener('click', () => {
        const file = objectifierFileInput.files[0];
        if (!file) return;
        // Use the imageFile argument in callApi
        callApi('objectifier', {}, file);
    });

     // --- Scenarist ---
    const scenaristCharSelect = document.getElementById('scenarist-char');
    const scenaristScenarioSelect = document.getElementById('scenarist-scenario');
    const scenaristStartBtn = document.getElementById('scenarist-start-btn');
    const scenaristInput = document.getElementById('scenarist-input');
    const scenaristSendBtn = document.getElementById('scenarist-send-btn');
    const scenaristChatHistoryDiv = document.getElementById('scenarist-chat-history');
    let scenaristConversationHistory = []; // Separate history
    let currentCharacter = '';
    let currentScenario = '';

    scenaristStartBtn.addEventListener('click', () => {
        currentCharacter = scenaristCharSelect.value;
        currentScenario = scenaristScenarioSelect.value;
        scenaristConversationHistory = []; // Reset history
        scenaristChatHistoryDiv.innerHTML = `<div class="system-message">Scenario started: You are talking to ${currentCharacter} ${currentScenario}.</div>`; // System message
        scenaristInput.disabled = false;
        scenaristSendBtn.disabled = false;
        scenaristStartBtn.textContent = "Restart Scenario"; // Change button text
        console.log(`Scenario started with ${currentCharacter} ${currentScenario}`);
    });

     async function sendScenaristMessage() {
         const message = scenaristInput.value.trim();
         if (!message || !currentCharacter) return; // Don't send if scenario not started

         addChatMessage('scenarist', 'user', message);
         scenaristInput.value = ''; // Clear input
         scenaristConversationHistory.push({ role: 'user', parts: [message] });

         const thinkingIndicator = document.getElementById('scenarist-thinking');
         scenaristSendBtn.disabled = true;
         if (thinkingIndicator) thinkingIndicator.style.display = 'block';

         // Prepare data for API
         const promptData = {
             character: currentCharacter,
             scenario: currentScenario,
             history: scenaristConversationHistory,
             message: message
         };

        // Call API (similar structure to Ada's chat)
        const formData = new FormData();
        formData.append('tool', 'scenarist');
        formData.append('prompt_data', JSON.stringify(promptData));

        let resultHtml = 'Error: Could not contact the server.';

        try {
            const response = await fetch(apiEndpoint, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.error) {
                 resultHtml = `<p style="color: red;">${data.error}</p>`;
                 addChatMessage('scenarist', 'model', `(System: ${data.error})`);
            } else {
                 resultHtml = data.result;
                 addChatMessage('scenarist', 'model', resultHtml); // Add model response
                 scenaristConversationHistory.push({ role: 'model', parts: [resultHtml] });
            }

        } catch (error) {
             console.error(`API Call Error (Scenarist):`, error);
             resultHtml = `<p style="color: red;">${error.message || 'An unexpected error occurred.'}</p>`;
             addChatMessage('scenarist', 'model', `(System: ${error.message || 'An unexpected error occurred.'})`);
        } finally {
             if (thinkingIndicator) thinkingIndicator.style.display = 'none';
             scenaristSendBtn.disabled = false;
             // Keep history reasonable
             if (scenaristConversationHistory.length > 10) {
                  scenaristConversationHistory = scenaristConversationHistory.slice(-10);
             }
         }
    }

    scenaristSendBtn.addEventListener('click', sendScenaristMessage);
    scenaristInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendScenaristMessage();
        }
    });


    // --- Initial Setup ---
    // Activate the 'home' section by default
    document.getElementById('home-tool').style.display = 'block';
     document.querySelector('.nav-button[data-tool="home"]').classList.add('active');
     // Disable objectifier submit initially
     objectifierSubmitBtn.disabled = true;
     // Disable scenarist chat initially
     scenaristInput.disabled = true;
     scenaristSendBtn.disabled = true;

}); // End DOMContentLoaded