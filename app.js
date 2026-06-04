const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");
const compass = document.getElementById("compass");
const debugDiv = document.getElementById("debug");

let targetBearing = null;
let currentHeading = null;
let orientationListenerAdded = false;
let watchId = null;
let nearestBar = null;

button.addEventListener("click", async () => {
    statusDiv.innerHTML = "Recherche de votre position...";

    if (!navigator.geolocation) {
        statusDiv.innerHTML = "GPS non supporté";
        return;
    }

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    await initDeviceOrientation();

    navigator.geolocation.getCurrentPosition(
        onSuccess,
        onError,
        {
            enableHighAccuracy: true
        }
    );
});

async function initDeviceOrientation() {
    if (orientationListenerAdded) {
        return;
    }

    if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();

            if (permission === "granted") {
                addOrientationListeners();
                orientationListenerAdded = true;
            } else {
                debugDiv.innerHTML =
                    "Permission orientation refusée — vérifiez les permissions Brave / Shields.";
            }
        } catch (error) {
            console.warn("Erreur permission orientation", error);
            debugDiv.innerHTML =
                "Impossible d'accéder au capteur d'orientation — vérifiez Brave / Shields et HTTPS.";
        }
    } else if (typeof DeviceOrientationEvent !== "undefined") {
        addOrientationListeners();
        orientationListenerAdded = true;
    } else {
        debugDiv.innerHTML =
            "Capteur d'orientation non disponible sur ce navigateur. La boussole ne fonctionnera pas.";
    }
}

function addOrientationListeners() {
    window.addEventListener("deviceorientation", onDeviceOrientation);
    window.addEventListener("deviceorientationabsolute", onDeviceOrientation);
}

async function onSuccess(position) {
    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    statusDiv.innerHTML = "Recherche des bars...";

    try {
        const bars = await getNearbyBars(userLat, userLon);

        if (!bars || bars.length === 0) {
            statusDiv.innerHTML = "Aucun bar trouvé 🍺";
            return;
        }

        nearestBar = findNearestBar(userLat, userLon, bars);

        if (!nearestBar) {
            statusDiv.innerHTML = "Aucun bar valide trouvé 🍺";
            return;
        }

        updateBarState(userLat, userLon);
        renderStatus();
        updateCompass();
        startLocationWatcher();
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = "Erreur lors de la recherche des bars";
    }
}

function onError(error) {
    statusDiv.innerHTML = `Erreur GPS : ${error.message}`;
}

function getHeadingFromEvent(event) {
    if (typeof event.webkitCompassHeading === "number") {
        return normalizeAngle(event.webkitCompassHeading);
    }

    if (typeof event.alpha !== "number") {
        return null;
    }

    return normalizeAngle(event.alpha);
}

function onDeviceOrientation(event) {
    const heading = getHeadingFromEvent(event);

    if (heading == null) {
        return;
    }

    currentHeading = heading;
    updateCompass();

    debugDiv.innerHTML = `
        heading : ${heading.toFixed(1)}°<br>
        absolute : ${event.absolute}
    `;
}

function updateCompass() {
    if (targetBearing == null || currentHeading == null) {
        return;
    }

    const direction = normalizeAngle(targetBearing - currentHeading);
    compass.style.transform = `rotate(${direction}deg)`;
}

function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

window.addEventListener("load", () => {
    compass.innerText = "↑";
});