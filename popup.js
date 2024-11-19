const clearBtn = document.getElementById("clearBtn");
const refreshBtn = document.getElementById("refreshData");
const confirmPopup = document.getElementById("confirmPopup");
const siteList = document.getElementById("siteList");
const siteListSection = document.getElementById("siteListSection");
const siteSearch = document.getElementById("siteSearch");
const selectAllCheckbox = document.getElementById("selectAll");
const siteSoundsList = document.getElementById("siteSoundsList");

let selectedAction = null;
let allSites = [];

document.querySelectorAll('input[name="action"]').forEach(radio => {
    radio.addEventListener("change", () => {
        selectedAction = radio.value;
        clearBtn.disabled = false;
        refreshBtn.disabled = false;

        if (selectedAction === "deleteCookies") {
            loadCookies();
            siteListSection.style.display = "block";
        } else {
            siteListSection.style.display = "none";
        }
    });
});

refreshBtn.addEventListener("click", () => {
    if (selectedAction === "deleteCookies") {
        loadCookies();
    } else if (selectedAction === "deleteHistory") {
        alert("History data refreshed.");
    }
});

siteSearch.addEventListener("input", () => {
    const query = siteSearch.value.toLowerCase();
    const filteredSites = allSites.filter(site => site.toLowerCase().includes(query));
    renderSiteList(filteredSites);
});

selectAllCheckbox.addEventListener("change", () => {
    const checkboxes = document.querySelectorAll(".site-checkbox");
    checkboxes.forEach(checkbox => (checkbox.checked = selectAllCheckbox.checked));
});

clearBtn.addEventListener("click", () => {
    if (selectedAction === "deleteHistory") {
        chrome.browsingData.remove({}, { history: true }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error clearing browsing history:", chrome.runtime.lastError);
            } else {
                alert("Browsing history cleared.");
            }
        });
    } else if (selectedAction === "deleteCookies") {
        const checkedSites = Array.from(document.querySelectorAll(".site-checkbox:checked"))
            .map(checkbox => checkbox.value);

        if (checkedSites.length > 0) {
            clearCookiesAndData(checkedSites);
        } else {
            alert("No sites selected for clearing.");
        }
    }
});

function loadCookies() {
    siteList.innerHTML = "<p>Loading cookies...</p>";
    chrome.cookies.getAll({}, cookies => {
        allSites = Array.from(new Set(cookies.map(cookie => cookie.domain.replace(/^\./, ""))));
        renderSiteList(allSites);
    });
}

function renderSiteList(sites) {
    siteList.innerHTML = sites
        .map(site => `
            <div class="site-item">
              <input type="checkbox" class="site-checkbox" value="${site}" />
              <label>${site}</label>
            </div>
        `)
        .join("");
}

function clearCookiesAndData(sites) {
    const removalPromises = sites.map(site => {
        return new Promise(resolve => {
            chrome.cookies.getAll({ domain: site }, cookies => {
                cookies.forEach(cookie => {
                    const protocol = cookie.secure ? "https" : "http";
                    const cookieUrl = `${protocol}://${cookie.domain}${cookie.path}`;
                    chrome.cookies.remove({
                        url: cookieUrl,
                        name: cookie.name
                    });
                });
            });
            const origins = [
                `http://${site}`,
                `https://${site}`
            ];
            chrome.browsingData.remove(
                { origins },
                {
                    cookies: true,
                    cacheStorage: true,
                    localStorage: true,
                    indexedDB: true,
                    fileSystems: true,
                    serviceWorkers: true,
                    webSQL: true
                },
                resolve
            );
        });
    });
    Promise.all(removalPromises).then(() => {
        alert("Cookies and data cleared for selected sites.");
    });
}

function loadSiteSounds() {
    siteSoundsList.innerHTML = "<p>Loading site sounds...</p>";

    chrome.tabs.query({}, (tabs) => {
        const audibleSites = tabs
            .filter(tab => tab.audible)
            .map(tab => ({
                name: tab.title || tab.url,
                id: tab.id,
                volume: 100
            }));

        if (audibleSites.length > 0) {
            siteSoundsList.innerHTML = audibleSites
                .map(site => `
                    <div class="site-item">
                        <label>${site.name}</label>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value="${site.volume}" 
                            data-tab-id="${site.id}" 
                            class="volume-slider" 
                        />
                    </div>
                `)
                .join("");

            document.querySelectorAll(".volume-slider").forEach(slider => {
                slider.addEventListener("input", (event) => {
                    const tabId = parseInt(event.target.getAttribute("data-tab-id"));
                    const volume = event.target.value / 100;
                    adjustTabVolume(tabId, volume);
                });
            });
        } else {
            siteSoundsList.innerHTML = "<p>No sites are currently playing sound.</p>";
        }
    });
}

function adjustTabVolume(tabId, volume) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: (volume) => {
            const mediaElements = document.querySelectorAll("audio, video");
            mediaElements.forEach(media => (media.volume = volume));
        },
        args: [volume]
    });
}

loadSiteSounds();
