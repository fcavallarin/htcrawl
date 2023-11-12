// Empty service_worker used as proxy between node and the UI (devtools panel)

// Keep the worker active
setInterval(() => {
    try{
        chrome.runtime.sendMessage({ping: 1});
    }catch(e){
        console.error(`Exception from Service Worker: ${e}`)
    }
}, 500);