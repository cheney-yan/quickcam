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
var helpButton = document.getElementById("helpButton");
var helpModal = document.getElementById("help-modal");
var closeHelpButton = document.getElementById("closeHelp");

buttonSwitchCamera.disabled = true;
buttonCapture.disabled = true;
buttonCapture.title = "正在初始化摄像头...";
buttonProcess.disabled = true;
buttonProcess.title = "请先拍照";

var context;
var width;
var height;

// Camera switching variables
var cameras = [];
var currentCameraIndex = 0;
var currentStream = null;
var chatHistory = [];

var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
var isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer, Inc/.test(navigator.vendor);


var canvas = canvas;

context = canvas.getContext("2d");

if((isChrome || isSafari) && window.location.protocol == "http:") {
    savedImages.innerHTML = "<h1>此浏览器仅支持通过 https: 的摄像头视频流</h1>";
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
            buttonSwitchCamera.innerHTML = cameras.length === 0 ? '无' : '镜';
            buttonSwitchCamera.title = cameras.length === 0 ? '未检测到摄像头' : '只有一个摄像头可用';
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
        savedImages.innerHTML = "<h3>不支持摄像头。</h3>";
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
            savedImages.innerHTML = "<h3>摄像头不可用。请将摄像头连接到您的设备。</h3>";
            buttonCapture.disabled = true;
            buttonCapture.title = "摄像头不可用";
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
        buttonCapture.title = "拍照";
        document.querySelector('.holder').classList.add('live-view');
        await enumerateCameras(); // Re-enumerate cameras after stream starts
        updateCameraButtonText(); // Update button text with current camera name

    } catch (error) {
        console.log(error.name + ": " + error.message);
        buttonCapture.disabled = true;

        switch(error.name) {
            case "NotAllowedError":
                savedImages.innerHTML = "<h3>您无法使用此应用，因为您拒绝了摄像头访问。请刷新页面并允许此应用使用摄像头。</h3>";
                buttonCapture.title = "摄像头访问被拒绝";
                break;
            case "NotReadableError":
                savedImages.innerHTML = "<h3>摄像头不可用。您的摄像头可能正在被其他应用程序使用。</h3>";
                buttonCapture.title = "摄像头正被占用";
                break;
            case "NotFoundError":
                savedImages.innerHTML = "<h3>摄像头不可用。请将摄像头连接到您的设备。</h3>";
                buttonCapture.title = "未检测到摄像头";
                break;
            default:
                savedImages.innerHTML = "<h3>访问摄像头时出错：" + error.message + "</h3>";
                buttonCapture.title = "访问摄像头时出错";
        }
    }

}

// Update camera button text with current camera name
function updateCameraButtonText() {
    if (cameras.length > 1 && cameras[currentCameraIndex]) {
        const currentCamera = cameras[currentCameraIndex];
        const cameraName = currentCamera.label || `摄像头 ${currentCameraIndex + 1}`;
        buttonSwitchCamera.innerHTML = `镜`;
        buttonSwitchCamera.title = `点击切换 ${cameras.length} 个摄像头。当前使用：${cameraName}`;
    } else {
        buttonSwitchCamera.innerHTML = `镜`;
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
        buttonCapture.innerHTML = "重";
        
        setHeight();
        context.drawImage(video, 0, 0, video.offsetWidth, video.offsetHeight);
        document.querySelector('.holder').classList.remove('live-view');

        buttonProcess.disabled = false;
        buttonProcess.title = "处理图片";
        chatHistory = []; // Reset chat history for new image
    } else {
        makeCaptureButton();
    }
}

function makeCaptureButton() {
    canvas.style.display = "none";
    buttonCapture.innerHTML = "拍";
    buttonProcess.disabled = true;
    buttonProcess.title = "请先拍照";
    processingPanel.style.display = "none";
    document.querySelector('.holder').classList.add('live-view');
}

function handleButtonProcessClick() {
    // Show the processing panel and hide the main buttons
    processingPanel.style.display = "block";
    document.querySelector('.buttons').style.display = 'none';
    checkPrompt(); // Set initial state of the touchup button
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
        document.querySelector('.buttons').style.display = 'block';
        makeCaptureButton();
    }, 'image/png');
}

function handleCancelClick() {
    processingPanel.style.display = "none";
    document.querySelector('.buttons').style.display = 'block';
}

// Gemini AI Image Enhancement Function
async function enhanceImageWithAI(contents) {
    const apiKey = localStorage.getItem('apiKey');
    const apiEndpoint = 'https://vertex.yan.today';

    if (!apiKey) {
        throw new Error('密码未设置。请在设置中配置。');
    }

    const data = JSON.stringify({
        contents: contents,
        safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }
        ],
        tools: [],
        generationConfig: {
            "temperature": 1,
            "topP": 1,
            "responseModalities": [
                "TEXT",
                "IMAGE"
            ]
        }
    });

    try {
        const response = await fetch(`${apiEndpoint}/v1beta/models/gemini-2.5-flash-image-preview:streamGenerateContent?alt=sse`, {
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

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let enhancedImageBase64 = null;
        let modelResponseParts = [];
        let fullResponseTextForDebugging = '';

        const processLine = (line) => {
            if (line.startsWith('data:')) {
                fullResponseTextForDebugging += line + '\n';
                try {
                    const jsonStr = line.substring(5).trim();
                    if (jsonStr) {
                        const responseJson = JSON.parse(jsonStr);
                        if (responseJson?.candidates && responseJson.candidates.length > 0) {
                            const candidate = responseJson.candidates[0];
                            if (candidate.content && candidate.content.parts) {
                                modelResponseParts.push(...candidate.content.parts);
                                for (const part of candidate.content.parts) {
                                    if (part.inlineData && part.inlineData.data) {
                                        enhancedImageBase64 = part.inlineData.data;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error parsing JSON from stream line:', line, e);
                }
            }
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                if (buffer.length > 0) processLine(buffer);
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                processLine(line);
            }
        }

        if (enhancedImageBase64) {
            const modelResponse = {
                role: 'model',
                parts: modelResponseParts
            };
            return { enhancedImageBase64, modelResponse };
        }
        
        console.error('Unexpected API response:', fullResponseTextForDebugging);
        throw new Error('API 响应中未找到增强图像。请检查控制台以获取详细信息。');
        
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
    

    try {
        setLoadingState(true);
        
        const imageDataUrl = canvas.toDataURL('image/png');
        const imageBase64 = imageDataUrl.split(',')[1];
        
        let currentUserMessage;
        if (chatHistory.length === 0) {
            currentUserMessage = {
                role: 'user',
                parts: [
                    { text: `Make adjustment, ${prompt}. Use original resolution` },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            };
        } else {
            currentUserMessage = {
                role: 'user',
                parts: [ { text: prompt } ]
            };
        }

        const contents = [...chatHistory, currentUserMessage];
        const { enhancedImageBase64, modelResponse } = await enhanceImageWithAI(contents);
        
        chatHistory.push(currentUserMessage);
        chatHistory.push(modelResponse);

        const enhancedImage = new Image();
        enhancedImage.onload = function() {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(enhancedImage, 0, 0, canvas.width, canvas.height);
            setLoadingState(false);
        };
        
        enhancedImage.onerror = function() {
            setLoadingState(false);
            alert('加载增强图像时出错。请再试一次。');
        };
        
        enhancedImage.src = `data:image/png;base64,${enhancedImageBase64}`;
        
    } catch (error) {
        setLoadingState(false);
        console.error('Enhancement failed:', error);
        
        if (error.message.includes('API_KEY')) {
            alert('请在 script.js 文件中设置您的 Gemini 密码以使用 AI 增强功能。');
        } else {
            alert(`AI 增强失败：${error.message}`);
        }
    }
}

function openSettingsModal() {
    apiKeyInput.value = localStorage.getItem('apiKey') || '';
    settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

function saveSettings() {
    localStorage.setItem('apiKey', apiKeyInput.value);
    closeSettingsModal();
}

function openHelpModal() {
    helpModal.style.display = 'flex';
}

function closeHelpModal() {
    helpModal.style.display = 'none';
}

function checkPrompt() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        touchupButton.disabled = true;
        touchupButton.title = "请先输入您的愿望";
    } else {
        touchupButton.disabled = false;
        touchupButton.title = "开始施法";
    }
}
 
 // Add event listeners
 promptInput.addEventListener("input", checkPrompt);
 settingsButton.addEventListener("mousedown", openSettingsModal);
 saveSettingsButton.addEventListener("mousedown", saveSettings);
 cancelSettingsButton.addEventListener("mousedown", closeSettingsModal);
 helpButton.addEventListener("mousedown", openHelpModal);
 closeHelpButton.addEventListener("mousedown", closeHelpModal);
 buttonSwitchCamera.addEventListener("mousedown", switchCamera);
buttonCapture.addEventListener("mousedown", handleButtonCaptureClick);
buttonProcess.addEventListener("mousedown", handleButtonProcessClick);
saveButton.addEventListener("mousedown", handleSaveClick);
cancelButton.addEventListener("mousedown", handleCancelClick);
touchupButton.addEventListener("mousedown", handleTouchupClick);
promptInput.addEventListener("focus", function() {
    this.select();
});