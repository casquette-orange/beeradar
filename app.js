// declarer 4 constante
const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");
const debugDiv = document.getElementById("debug");
const arrow = document.getElementById("arrow");

// declarer 3 variables
let currentBearing = 0; //orientation du telephone vers le bar
let currentOrientation = 0; //orientation du tel
let nearestBar = null;

// rajoute a la constante button un evenement en ecoute pour permettre le clique puis la recherche du bar le plus proche
button.addEventListener("click", startSearch);

// permet de demarrer la recherche de bar
function startSearch() {

    statusDiv.innerHTML =
        "Recherche de votre position...";

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

// fonction principale permettant de mettre a jour en temps reel la recherche
async function onPositionUpdate(position) {

    const userLat = position.coords.latitude;
    const userLon = position.coords.longitude;

    try {

        if (!nearestBar) {

            statusDiv.innerHTML =
                "Recherche des bars...";

            const bars =
                await getNearbyBars(
                    userLat,
                    userLon
                ); // 

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

        // DEBUG
        console.log(
            "currentBearing =",
            currentBearing
        );
        //

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

function onError(error) {

    statusDiv.innerHTML =
        `Erreur GPS : ${error.message}`;
}

window.addEventListener(
    "deviceorientation",
    (event) => {

        if (event.alpha == null) {
            return;
        }

        currentOrientation =
            event.alpha;

        updateCompass();
    }
);

function updateCompass() {

    const angleVersBar =
        currentBearing +
        currentOrientation;

    arrow.style.transform =
        `translate(-50%, -50%) rotate(${angleVersBar}deg)`;

    debugDiv.innerHTML = `
        bearing : ${currentBearing.toFixed(0)}°<br>
        orientation : ${currentOrientation.toFixed(0)}°<br>
        angle : ${angleVersBar.toFixed(0)}°
    `;
}

// fonction qui permet de recuperer les bars les plus proche
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

function toRadians(degrees) {

    return (
        degrees *
        Math.PI /
        180
    );
}