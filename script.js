var buttonCapture = document.getElementById("buttonCapture");
var buttonSave = document.getElementById("buttonSave");
var buttonSwitchCamera = document.getElementById("buttonSwitchCamera");
var savedImages = document.getElementById("savedImages");
var canvas = document.getElementById("canvas");
var video = document.getElementById("video");

var context;
var width = 450; //set width of the video and image
var height;

// Camera switching variables
var cameras = [];
var currentCameraIndex = 0;
var currentStream = null;

var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
var isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer, Inc/.test(navigator.vendor);

video.width = width;

var canvas = canvas;
canvas.style.width = width + "px";
canvas.width = width;

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
            buttonSwitchCamera.innerHTML = cameras.length === 0 ? 'No Cameras' : 'Switch Camera';
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

    function setHeight() {
        var ratio = video.videoWidth / video.videoHeight;
        height = width/ratio;
        canvas.style.height = height + "px";
        canvas.height = height;
    }

    // Update camera button text with current camera name
    function updateCameraButtonText() {
        if (cameras.length > 1 && cameras[currentCameraIndex]) {
            const currentCamera = cameras[currentCameraIndex];
            const cameraName = currentCamera.label || `Camera ${currentCameraIndex + 1}`;
            buttonSwitchCamera.innerHTML = `📷 ${cameraName}`;
            buttonSwitchCamera.title = `Click to switch between ${cameras.length} cameras. Currently using: ${cameraName}`;
        }
    }

    // Camera switching function
    async function switchCamera() {
        if (cameras.length <= 1) return;
        
        currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
        await startWebcam(cameras[currentCameraIndex].deviceId);
        updateCameraButtonText();
    }

    //add event listener and handle the switch camera button
    buttonSwitchCamera.addEventListener("mousedown", switchCamera);

    //add event listener and handle the capture button
    buttonCapture.addEventListener("mousedown", handleButtonCaptureClick);

    function handleButtonCaptureClick() {
        if(canvas.style.display == "none" || canvas.style.display == ""){
            canvas.style.display = "block";
            buttonCapture.innerHTML = "Retake";
            
            setHeight();
            context.drawImage(video, 0, 0, width, height);

            buttonSave.innerHTML = "Save";
            buttonSave.disabled = false;
        } else {
            makeCaptureButton();
        }
    }
    
    function makeCaptureButton() {
        canvas.style.display = "none";
        buttonCapture.innerHTML = "Capture";
        buttonSave.innerHTML = "Save";
        buttonSave.disabled = true;
    }

    //add event listener and handle the save button
    buttonSave.addEventListener("mousedown", handleButtonSaveClick);
    
    function handleButtonSaveClick() {
        var dataURL = canvas.toDataURL("image/jpg");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "save.php"); //change this to .php or .asp, depending on your server
        xhr.onload = function() {
            if (xhr.readyState == 4 ) {
                if(xhr.status == 200) {
                    var image = new Image();
                    image.src = "images/" + xhr.responseText;
                    savedImages.insertAdjacentElement('afterbegin', image);
                    buttonSave.innerHTML = "Saved";
                    buttonSave.disabled = true;
                    makeCaptureButton();
                }
            }
        };
        var form = new FormData();
        form.append("image", dataURL);
        xhr.send(form);
    }
}