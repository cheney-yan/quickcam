var buttonCapture = document.getElementById("buttonCapture");
var buttonProcess = document.getElementById("buttonProcess");
var buttonSwitchCamera = document.getElementById("buttonSwitch");
var processingPanel = document.getElementById("processing-panel");
var saveButton = document.getElementById("save");
var touchupButton = document.getElementById("touchup");
var cancelButton = document.getElementById("cancel");
var promptInput = document.getElementById("aiPrompt");
var loadingOverlay = document.getElementById("loading-overlay");
var savedImages = document.getElementById("savedImages");
var canvas = document.getElementById("canvas");
var video = document.getElementById("video");
var settingsButton = document.getElementById("settingsButton");
var settingsModal = document.getElementById("settings-modal");
var saveSettingsButton = document.getElementById("saveSettings");
var cancelSettingsButton = document.getElementById("cancelSettings");
var apiKeyInput = document.getElementById("apiKey");
var apiEndpointInput = document.getElementById("apiEndpoint");

buttonSwitchCamera.disabled = true;
buttonCapture.disabled = true;
buttonProcess.disabled = true;

var context;
var width;
var height;

// Camera switching variables
var cameras = [];
var currentCameraIndex = 0;
var currentStream = null;

var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
var isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer, Inc/.test(navigator.vendor);


var canvas = canvas;

context = canvas.getContext("2d");

if((isChrome || isSafari) && window.location.protocol == "http:") {
    savedImages.innerHTML = "<h1>This browser only supports camera streams over https:</h1>";
} else {
    startWebcam();
}

async function enumerateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');
        
        // Enable/disable switch camera button based on number of cameras
        if (cameras.length > 1) {
            buttonSwitchCamera.disabled = false;
            updateCameraButtonText();
        } else {
            buttonSwitchCamera.disabled = true;
            buttonSwitchCamera.innerHTML = cameras.length === 0 ? '🚫' : '🔄';
            buttonSwitchCamera.title = cameras.length === 0 ? 'No cameras detected' : 'Only one camera available';
        }
        
        return cameras.length > 0;
    } catch (error) {
        console.error('Error enumerating cameras:', error);
        buttonSwitchCamera.disabled = true;
        return false;
    }
}

async function startWebcam(deviceId = null) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mediaDevices || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;

    if (!navigator.mediaDevices) {
        savedImages.innerHTML = "<h3>Camera not supported.</h3>";
        return;
    }

    try {
        // Stop current stream if exists
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        // Enumerate cameras first
        const hasCameras = await enumerateCameras();
        if (!hasCameras) {
            savedImages.innerHTML = "<h3>Camera not available. Please connect a camera to your device.</h3>";
            buttonCapture.disabled = true;
            return;
        }

        // Set up video constraints
        const videoConstraints = { video: true };
        if (deviceId) {
            videoConstraints.video = { deviceId: deviceId };
        } else if (cameras.length > 0) {
            videoConstraints.video = { deviceId: cameras[currentCameraIndex].deviceId };
        }

        const stream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        currentStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = setHeight;
        buttonCapture.disabled = false;
        await enumerateCameras(); // Re-enumerate cameras after stream starts
        updateCameraButtonText(); // Update button text with current camera name

    } catch (error) {
        console.log(error.name + ": " + error.message);
        buttonCapture.disabled = true;

        switch(error.name) {
            case "NotAllowedError":
                savedImages.innerHTML = "<h3>You can't use this app because you denied camera access. Refresh the page and allow the camera to be used by this app.</h3>";
                break;
            case "NotReadableError":
                savedImages.innerHTML = "<h3>Camera not available. Your camera may be used by another application.</h3>";
                break;
            case "NotFoundError":
                savedImages.innerHTML = "<h3>Camera not available. Please connect a camera to your device.</h3>";
                break;
            default:
                savedImages.innerHTML = "<h3>Error accessing camera: " + error.message + "</h3>";
        }
    }

}

// Update camera button text with current camera name
function updateCameraButtonText() {
    if (cameras.length > 1 && cameras[currentCameraIndex]) {
        const currentCamera = cameras[currentCameraIndex];
        const cameraName = currentCamera.label || `Camera ${currentCameraIndex + 1}`;
        buttonSwitchCamera.innerHTML = `🔄`;
        buttonSwitchCamera.title = `Click to switch between ${cameras.length} cameras. Currently using: ${cameraName}`;
    } else {
        buttonSwitchCamera.innerHTML = `🔄`;
    }
}

// Helper function to set video and canvas height
function setHeight() {
    height = video.offsetHeight;
    width = video.offsetWidth;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
}

// Camera switching function
async function switchCamera() {
    if (cameras.length <= 1) return;
    
    currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
    await startWebcam(cameras[currentCameraIndex].deviceId);
    updateCameraButtonText();
}

function handleButtonCaptureClick() {
    if(canvas.style.display == "none" || canvas.style.display == ""){
        canvas.style.display = "block";
        buttonCapture.innerHTML = "↩️";
        
        setHeight();
        context.drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);

        buttonProcess.disabled = false;
    } else {
        makeCaptureButton();
    }
}

function makeCaptureButton() {
    canvas.style.display = "none";
    buttonCapture.innerHTML = "📸";
    buttonProcess.disabled = true;
    processingPanel.style.display = "none";
}

function handleButtonProcessClick() {
    // Show the processing panel
    processingPanel.style.display = "block";
}

function handleSaveClick() {
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `photo-${timestamp}`;
    
    // Convert canvas to blob and trigger download
    canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Hide processing panel after save
        processingPanel.style.display = 'none';
        makeCaptureButton();
    }, 'image/png');
}

function handleCancelClick() {
    processingPanel.style.display = "none";
}

// Gemini AI Image Enhancement Function
async function enhanceImageWithAI(imageBase64, prompt) {
    const apiKey = localStorage.getItem('apiKey');
    const apiEndpoint = localStorage.getItem('apiEndpoint') || 'https://generativelanguage.googleapis.com';

    if (!apiKey) {
        throw new Error('API key is not set. Please configure it in the settings.');
    }
    
    // Construct the request payload
    const data = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        text: `Make adjustment, ${prompt}. Use original resolution`
                    },
                    {
                        inline_data: {
                            mime_type: 'image/png',
                            data: imageBase64
                        }
                    }
                ]
            }
        ]
    });

    try {
        const response = await fetch(`${apiEndpoint}/v1beta/models/gemini-2.5-flash-image-preview:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: data
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const responseJson = await response.json();
        
        // Extract the enhanced image from response
        if (responseJson?.candidates && responseJson.candidates.length > 0) {
            const candidate = responseJson.candidates[0];
            if (candidate.content && candidate.content.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return part.inlineData.data;
                    }
                }
            }
        }
        
        console.error('Unexpected API response:', responseJson);
        throw new Error('No enhanced image found in API response. Check console for details.');
        
    } catch (error) {
        console.error('AI Enhancement Error:', error);
        throw error;
    }
}

// Show/Hide loading state
function setLoadingState(isLoading) {
    if (isLoading) {
        loadingOverlay.style.display = 'flex';
        touchupButton.disabled = true;
        saveButton.disabled = true;
        promptInput.disabled = true;
    } else {
        loadingOverlay.style.display = 'none';
        touchupButton.disabled = false;
        saveButton.disabled = false;
        promptInput.disabled = false;
    }
}

async function handleTouchupClick() {
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
        alert('Please enter a prompt describing how you want to enhance the image.');
        return;
    }

    try {
        // Show loading state
        setLoadingState(true);
        
        // Get current image data from canvas as base64
        const imageDataUrl = canvas.toDataURL('image/png');
        const imageBase64 = imageDataUrl.split(',')[1]; // Remove data:image/png;base64, prefix
        
        // Call Gemini API to enhance the image
        const enhancedImageBase64 = await enhanceImageWithAI(imageBase64, prompt);
        
        // Create new image and replace canvas content
        const enhancedImage = new Image();
        enhancedImage.onload = function() {
            // Clear canvas and draw enhanced image
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(enhancedImage, 0, 0, canvas.width, canvas.height);
            
            // Hide loading state
            setLoadingState(false);
            
        };
        
        enhancedImage.onerror = function() {
            setLoadingState(false);
            alert('Error loading the enhanced image. Please try again.');
        };
        
        // Set the enhanced image source
        enhancedImage.src = `data:image/png;base64,${enhancedImageBase64}`;
        
    } catch (error) {
        setLoadingState(false);
        console.error('Enhancement failed:', error);
        
        if (error.message.includes('API_KEY')) {
            alert('Please set up your Gemini API key in the script.js file to use AI enhancement.');
        } else {
            alert(`AI enhancement failed: ${error.message}`);
        }
    }
}

function openSettingsModal() {
    apiKeyInput.value = localStorage.getItem('apiKey') || '';
    apiEndpointInput.value = localStorage.getItem('apiEndpoint') || 'https://generativelanguage.googleapis.com';
    settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

function saveSettings() {
    localStorage.setItem('apiKey', apiKeyInput.value);
    localStorage.setItem('apiEndpoint', apiEndpointInput.value);
    closeSettingsModal();
}
 
 // Add event listeners
 settingsButton.addEventListener("mousedown", openSettingsModal);
 saveSettingsButton.addEventListener("mousedown", saveSettings);
 cancelSettingsButton.addEventListener("mousedown", closeSettingsModal);
 buttonSwitchCamera.addEventListener("mousedown", switchCamera);
buttonCapture.addEventListener("mousedown", handleButtonCaptureClick);
buttonProcess.addEventListener("mousedown", handleButtonProcessClick);
saveButton.addEventListener("mousedown", handleSaveClick);
cancelButton.addEventListener("mousedown", handleCancelClick);
touchupButton.addEventListener("mousedown", handleTouchupClick);
promptInput.addEventListener("focus", function() {
    this.select();
});