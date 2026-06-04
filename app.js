const button = document.getElementById("searchButton");
const statusDiv = document.getElementById("status");

button.addEventListener("click", () => {

    statusDiv.textContent = "Recherche de votre position...";

    if (!navigator.geolocation) {
        statusDiv.textContent =
            "La géolocalisation n'est pas supportée.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        onSuccess,
        onError
    );
});

function onSuccess(position) {

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    statusDiv.innerHTML = `
        Latitude : ${latitude}<br>
        Longitude : ${longitude}
    `;
}

function onError(error) {

    console.log(error);

    statusDiv.textContent =
        `Erreur GPS : ${error.code} - ${error.message}`;
}