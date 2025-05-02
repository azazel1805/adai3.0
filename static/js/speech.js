// --- Speech Recognition (Ada) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isAdaSpeechEnabled = true; // Flag for speech synthesis mute/unmute
window.isAdaSpeechEnabled = isAdaSpeechEnabled; // Make accessible globally

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    const adaMicBtn = document.getElementById('ada-mic-btn');
    const adaInput = document.getElementById('ada-input');

    recognition.continuous = false; // Stop after one utterance
    recognition.lang = 'en-GB';     // British English
    recognition.interimResults = false; // Get final result only
    recognition.maxAlternatives = 1;

    adaMicBtn.addEventListener('click', () => {
        if (adaMicBtn.classList.contains('recording')) {
            recognition.stop();
            console.log("Speech recognition stopped manually.");
        } else {
            try {
                 recognition.start();
                 console.log("Speech recognition started.");
                 adaMicBtn.classList.add('recording');
                 adaMicBtn.textContent = '🛑'; // Indicate recording
            } catch(e) {
                 console.error("Speech recognition could not start:", e);
                 alert("Speech recognition could not start. Make sure microphone permissions are granted and no other recognition is active.");
            }

        }
    });

    recognition.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        console.log('Speech Result:', speechResult);
        // Append result to input field, or replace if desired
        adaInput.value += (adaInput.value ? ' ' : '') + speechResult;
        // Optionally trigger send after recognition:
        // document.getElementById('ada-send-btn').click();
    };

    recognition.onspeechend = () => {
        recognition.stop();
        console.log("Speech recognition stopped due to speech end.");
    };

    recognition.onend = () => {
        adaMicBtn.classList.remove('recording');
        adaMicBtn.textContent = '🎤';
         console.log("Speech recognition service disconnected.");
    }

    recognition.onerror = (event) => {
        console.error(`Speech recognition error: ${event.error}`);
        alert(`Speech recognition error: ${event.error}. Please check microphone permissions.`);
        adaMicBtn.classList.remove('recording');
        adaMicBtn.textContent = '🎤';
    };

} else {
    console.warn("Speech Recognition API not supported in this browser.");
    const adaMicBtn = document.getElementById('ada-mic-btn');
    if(adaMicBtn) {
        adaMicBtn.disabled = true;
        adaMicBtn.title = "Speech recognition not supported";
    }
}

// --- Speech Synthesis (Ada) ---
const synth = window.speechSynthesis;
let voices = [];

function populateVoiceList() {
  if(typeof synth === 'undefined') {
    return;
  }
  voices = synth.getVoices();
  // You could add logic here to find a specific 'en-GB' voice if needed
}

populateVoiceList();
if (synth && synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = populateVoiceList;
}

function speakText(textToSpeak) {
    if (!synth || !isAdaSpeechEnabled) return; // Check synth support and mute flag

    if (synth.speaking) {
        console.warn('SpeechSynthesis.speaking: Already speaking.');
        // Optionally cancel previous speech: synth.cancel();
        return;
    }

     // Clean up text a bit for speech (remove potential HTML tags if any sneaked through)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = textToSpeak;
    const cleanText = tempDiv.textContent || tempDiv.innerText || "";

    if (cleanText.trim()) {
        const utterThis = new SpeechSynthesisUtterance(cleanText);

        utterThis.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
        };

        // Optional: Try to select a British voice
        const britishVoice = voices.find(voice => voice.lang === 'en-GB');
        if (britishVoice) {
            utterThis.voice = britishVoice;
            console.log("Using voice:", britishVoice.name, britishVoice.lang);
        } else {
             console.log("Default voice used.");
        }
        // Adjust pitch and rate if desired
        // utterThis.pitch = 1;
        // utterThis.rate = 1;

        synth.speak(utterThis);
    }
}

// Mute/Unmute Button Logic
const adaMuteBtn = document.getElementById('ada-mute-btn');
if (adaMuteBtn) {
    adaMuteBtn.addEventListener('click', () => {
        isAdaSpeechEnabled = !isAdaSpeechEnabled;
        window.isAdaSpeechEnabled = isAdaSpeechEnabled; // Update global flag
        adaMuteBtn.textContent = isAdaSpeechEnabled ? '🔊' : '🔇';
        adaMuteBtn.title = isAdaSpeechEnabled ? 'Mute Ada\'s voice' : 'Unmute Ada\'s voice';
        if (!isAdaSpeechEnabled && synth.speaking) {
            synth.cancel(); // Stop current speech if muted
        }
        console.log("Ada speech enabled:", isAdaSpeechEnabled);
    });
}