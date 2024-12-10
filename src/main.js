import '/src/style.css'

const clientId = "e5c145fb17194bb1a38e02708edd074f"; 
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

const localToken = localStorage.getItem('token') !== null ? localStorage.getItem('token') : 'undefined';
const localTokenExpire = localStorage.getItem('tokenExpireDate');
const diff = Date.now() - localTokenExpire;

console.log(localToken);

if(localToken != 'undefined' && diff < (60*60*1000)) { //1h in ms
    const data = await fetchData(localToken);
    populateUI(data);
} else if (!code) {
    redirectToAuthCodeFlow(clientId);
} else { //return from callback
    const accessToken = await getAccessToken(clientId, code);
    const data = await fetchData(localToken);
    populateUI(data);
}

export async function redirectToAuthCodeFlow(clientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://localhost:5173");
    params.append("scope", "user-read-private user-read-email user-follow-read");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    console.log(params);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
export async function getAccessToken(clientId, code) {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://localhost:5173");
    params.append("code_verifier", verifier);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();

    localStorage.setItem('token', access_token);
    localStorage.setItem('tokenExpireDate', Date.now())
    return access_token;
}

async function fetchData(token) {
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    const profile = await profileResponse.json();

    const artistsResponse = await fetch("https://api.spotify.com/v1/me/following?type=artist", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    const followedArtists = await artistsResponse.json();

    return { profile, followedArtists: followedArtists.artists }; 
}
function populateUI(data) {
    const { profile, followedArtists } = data;

    //profile
    document.getElementById("navbar-username").innerText = profile.display_name;

    if (profile.images && profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("navbar-avatar").appendChild(profileImage);
    }

    //artists
    const artistsContainer = document.getElementById("followed-artists");

    followedArtists.items.forEach(artist => {
        const artistDiv = document.createElement("div");
        artistDiv.classList.add("artist");

        //artist img
        if (artist.images && artist.images[0]) {
            const artistImage = new Image(100, 100);
            artistImage.src = artist.images[0].url;
            artistImage.alt = `${artist.name}'s image`;
            artistDiv.appendChild(artistImage);
        }

        //artist name
        const artistName = document.createElement("a");
        artistName.innerText = artist.name;
        artistName.href = artist.external_urls.spotify;
        artistDiv.appendChild(artistName);

        //artist follower count
        const artistFollowers = document.createElement("p");
        artistFollowers.innerText = formatNumber(artist.followers.total) + " followers";
        artistFollowers.classList.add("artist-followers");
        artistDiv.appendChild(artistFollowers);

        artistsContainer.appendChild(artistDiv);
    });
}

document.getElementById("searchbutton").addEventListener("click", (e) => {
    search(localToken);
})
async function search(token) {
    const query = document.getElementById("searchinput").value;
    const params = new URLSearchParams();
    params.append("q", query);
    params.append("type", "track");
    params.append("limit", "10");

    const searchResponse = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });

    const data = await searchResponse.json();
    const tracks = data.tracks.items;
    const resultsContainer = document.getElementById("searchResults");

    resultsContainer.innerHTML = '';

    if (tracks.length > 0) {
        document.getElementById("iframe").src = `https://open.spotify.com/embed/track/${tracks[0].id}?utm_source=generator`;
        tracks.forEach(track => {
            const listItem = document.createElement("li");
            listItem.classList.add("track-item");

            listItem.innerHTML = `
                <a>${track.name}</a> by ${track.artists.map(artist => artist.name).join(', ')}
                <br>
            `;

            resultsContainer.appendChild(listItem);
        });
    } else {
        resultsContainer.innerHTML = "No tracks found.";
    }
}

function formatNumber(num) {
    if (num >= 1_000_000) {
        return (num / 1_000_000).toPrecision(3) + 'M';
    } else if (num >= 1_000) {
        return (num / 1_000).toPrecision(3) + 'K';
    } else {
        return num;
    }
}
function test() {
    console.log("j");
}