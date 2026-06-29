// ============================================================
// BEER RADAR - app.js
// Geolocalisation + recherche du bar le plus proche
// + boussole (oriente vers le nord) + fleche (oriente vers le bar)
// ============================================================

// declarer les constantes liees aux elements du DOM
const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");
const debugDiv = document.getElementById("debug");
const arrow = document.getElementById("arrow");
const compassRose = document.getElementById("compassRose");

// declarer les variables d'etat de l'appli
let currentBearing = 0;     // direction (en degres, 0 = nord) vers le bar le plus proche
let currentOrientation = 0; // direction (en degres, 0 = nord) vers laquelle pointe le telephone
let nearestBar = null;      // le bar le plus proche trouve
let orientationListenerAdded = false; // garde-fou contre les doubles ecouteurs

// rajoute a la constante button un evenement en ecoute pour permettre le clique puis la recherche du bar le plus proche
button.addEventListener("click", startSearch);


// ============================================================
// DEMARRAGE DE LA RECHERCHE
// ============================================================

// permet de demarrer la recherche de bar
function startSearch() {

    statusDiv.innerHTML =
        "Recherche de votre position...";

    // demande la permission d'utiliser le capteur d'orientation (obligatoire sur iOS 13+)
    // sur Android cette fonction n'existe pas, donc on ecoute directement
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {

        DeviceOrientationEvent.requestPermission()
            .then((permissionState) => {

                if (permissionState === "granted") {
                    if (!orientationListenerAdded) {
                        window.addEventListener("deviceorientation", onOrientationUpdate);
                        orientationListenerAdded = true;
                    }
                } else {
                    statusDiv.innerHTML =
                        "Permission boussole refusée";
                }
            })
            .catch(console.error);

    } else {

        if (!orientationListenerAdded) {
            window.addEventListener("deviceorientation", onOrientationUpdate);
            orientationListenerAdded = true;
        }
    }

    // demarre le suivi GPS en continu
    navigator.geolocation.watchPosition(
        onPositionUpdate,
        onError,
        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        }
    );
}


// ============================================================
// GESTION DE LA POSITION GPS
// ============================================================

// fonction principale appelee a chaque mise a jour de la position
async function onPositionUpdate(position) {

    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    try {

        // si on n'a pas encore de bar cible, on en cherche un
        if (!nearestBar) {

            statusDiv.innerHTML =
                "Recherche des bars...";

            const bars =
                await getNearbyBars(
                    userLat,
                    userLon
                );

            if (!bars.length) {

                statusDiv.innerHTML =
                    "Aucun bar trouvé 🍺";

                return;
            }

            nearestBar =
                findNearestBar(
                    userLat,
                    userLon,
                    bars
                );
        }

        // calcul distance + direction vers le bar cible
        const distance =
            haversineDistance(
                userLat,
                userLon,
                nearestBar.lat,
                nearestBar.lon
            );

        currentBearing =
            calculateBearing(
                userLat,
                userLon,
                nearestBar.lat,
                nearestBar.lon
            );

        updateCompass();

        statusDiv.innerHTML = `
            <div style="font-size:32px">
                🍺
            </div>

            <div style="
                font-size:28px;
                font-weight:bold;
                margin-top:10px;
            ">
                ${nearestBar.name}
            </div>

            <div style="
                font-size:48px;
                margin-top:15px;
            ">
                ${distance.toFixed(0)} m
            </div>

            <div style="
                margin-top:10px;
                font-size:20px;
            ">
                Direction : ${currentBearing.toFixed(0)}°
            </div>
        `;

    } catch (error) {

        console.error(error);

        statusDiv.innerHTML =
            "Erreur lors de la recherche des bars";
    }
}

// fonction appelee si la geolocalisation echoue
function onError(error) {

    statusDiv.innerHTML =
        `Erreur GPS : ${error.message}`;
}


// ============================================================
// GESTION DE L'ORIENTATION DU TELEPHONE
// ============================================================

// fonction appelee chaque fois que le telephone change d'orientation
function onOrientationUpdate(event) {

    if (event.alpha == null) {
        return;
    }

    // Sur iOS : webkitCompassHeading donne le cap magnetique reel (0-360, sens horaire depuis le nord)
    // Sur Android : event.alpha donne la rotation autour de l'axe Z (0-360)
    // Sans cette distinction, la boussole tourne dans le mauvais sens ou au mauvais rythme sur iOS
    if (event.webkitCompassHeading != null) {
        currentOrientation = event.webkitCompassHeading;
    } else {
        currentOrientation = event.alpha % 360;
    }

    updateCompass();
}


// ============================================================
// MISE A JOUR VISUELLE DE LA BOUSSOLE
// ============================================================

// fait tourner le cadran vers le nord, et la fleche vers le bar
function updateCompass() {

    // le cadran tourne a l'inverse du telephone, pour que le N reste toujours vers le vrai nord
    const angleBoussole = -currentOrientation;

    compassRose.style.transform =
        `translate(-50%, -50%) rotate(${angleBoussole}deg)`;

    // la fleche pointe vers le bar : direction absolue du bar moins l'orientation du telephone
    const angleFleche = currentBearing - currentOrientation;

    arrow.style.transform =
        `translate(-50%, -50%) rotate(${angleFleche}deg)`;

    debugDiv.innerHTML = `
        bearing : ${currentBearing.toFixed(0)}°<br>
        orientation : ${currentOrientation.toFixed(0)}°<br>
        angle boussole : ${angleBoussole.toFixed(0)}°<br>
        angle fleche : ${angleFleche.toFixed(0)}°
    `;
}


// ============================================================
// RECHERCHE DES BARS (API OVERPASS / OPENSTREETMAP)
// ============================================================

// fonction qui permet de recuperer les bars les plus proches
async function getNearbyBars(lat, lon) {

    const radius = 1000;

    const query = `
[out:json];
(
  node["amenity"="bar"](around:${radius},${lat},${lon});
  node["amenity"="pub"](around:${radius},${lat},${lon});
);
out body;
`;

    const response =
        await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                body: query
            }
        );

    if (!response.ok) {

        throw new Error(
            "Overpass indisponible"
        );
    }

    const data =
        await response.json();

    return data.elements || [];
}

// trouve le bar le plus proche parmi une liste de bars
function findNearestBar(
    userLat,
    userLon,
    bars
) {

    let nearest = null;
    let minDistance = Infinity;

    for (const bar of bars) {

        const distance =
            haversineDistance(
                userLat,
                userLon,
                bar.lat,
                bar.lon
            );

        if (distance < minDistance) {

            minDistance = distance;

            nearest = {

                name:
                    bar.tags?.name ||
                    "Bar inconnu",

                lat: bar.lat,
                lon: bar.lon
            };
        }
    }

    return nearest;
}


// ============================================================
// FONCTIONS MATHEMATIQUES (distance / direction / conversion)
// ============================================================

// calcule la direction (en degres, 0 = nord) entre deux points GPS
function calculateBearing(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const λ1 = toRadians(lon1);
    const λ2 = toRadians(lon2);

    const y =
        Math.sin(λ2 - λ1) *
        Math.cos(φ2);

    const x =
        Math.cos(φ1) *
        Math.sin(φ2)
        -
        Math.sin(φ1) *
        Math.cos(φ2) *
        Math.cos(λ2 - λ1);

    const bearing =
        Math.atan2(y, x) *
        180 /
        Math.PI;

    return (
        bearing + 360
    ) % 360;
}

// calcule la distance (en metres) entre deux points GPS
function haversineDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        toRadians(lat2 - lat1);

    const dLon =
        toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}

// convertit des degres en radians
function toRadians(degrees) {

    return (
        degrees *
        Math.PI /
        180
    );
}