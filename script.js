document.addEventListener('DOMContentLoaded', () => {
    // Elementos da UI
    const startScreen = document.getElementById('start-screen');
    const callScreen = document.getElementById('call-screen');
    const arView = document.getElementById('ar-view');
    const startButton = document.getElementById('start-button');
    const dustinImage = document.getElementById('dustin-image');
    const dustinAudio = document.getElementById('dustin-audio');
    const compassArrow = document.getElementById('compass-arrow');
    const scene = document.getElementById('a-scene');

    // Estado do Jogo
    let currentMission = 0;
    let watchId = null;
    let deviceOrientationHandler = null;

    const missions = [
        { // Missão 1
            lat: -27.631781070044788,
            lon: -48.67967086580981,
            introAudio: 'assets/dustin-intro.wav',
            completionAudio: 'assets/dustin-missao-1-completa.wav',
            objectModel: '#bike-model',
            isCollected: false
        },
        { // Missão 2
            lat: -27.630594320828294,
            lon: -48.681127324423436,
            introAudio: null, // O áudio é da missão anterior
            completionAudio: null, // Adicionar um áudio final se quiser
            objectModel: '#taco-model',
            isCollected: false
        }
    ];

    // --- INÍCIO DO JOGO ---
    startButton.addEventListener('click', () => {
        // Solicitar permissões antes de tudo
        requestAllPermissions().then(() => {
            startMission(0);
        }).catch(err => {
            alert('Você precisa permitir o acesso à câmera e localização para jogar.');
            console.error(err);
        });
    });

    function startMission(missionIndex) {
        currentMission = missionIndex;
        const mission = missions[currentMission];

        startScreen.classList.remove('active');
        arView.classList.remove('active');
        callScreen.classList.add('active');

        dustinAudio.src = mission.introAudio;

        // DENTRO DA FUNÇÃO startMission

// Função para tocar o áudio e continuar
function playAudioAndProceed() {
    console.log("Tentando tocar o áudio...");
    const playPromise = dustinAudio.play();

    if (playPromise !== undefined) {
        playPromise.then(_ => {
            // A reprodução de áudio começou com sucesso!
            console.log("Áudio iniciado!");
        }).catch(error => {
            // A reprodução falhou. Provavelmente bloqueada pelo navegador.
            console.error("Erro ao tocar áudio:", error);
            alert("Seu navegador bloqueou a reprodução. Por favor, clique novamente na imagem para tentar de novo.");
            // Re-adiciona o listener para uma nova tentativa do usuário
            dustinImage.addEventListener('click', playAudioAndProceed, { once: true });
        });
    }
}

// Resetar o listener para não ter múltiplos
const newDustinImage = dustinImage.cloneNode(true);
dustinImage.parentNode.replaceChild(newDustinImage, dustinImage);
// Acessa a nova referência do elemento
const finalDustinImage = document.getElementById('dustin-image');

finalDustinImage.addEventListener('click', playAudioAndProceed, { once: true });

dustinAudio.onended = () => {
    console.log("Áudio finalizado. Navegando para a missão.");
    callScreen.classList.remove('active');
    arView.classList.add('active'); // Ativa a câmera
    startNavigation();
};
    }

    // --- NAVEGAÇÃO E BÚSSOLA ---
    function startNavigation() {
        compassArrow.style.display = 'block';
        
        // Listener para a orientação do dispositivo (bússola)
        deviceOrientationHandler = (event) => {
            if (event.webkitCompassHeading) { // Para iOS
                updateCompass(event.webkitCompassHeading);
            } else if (event.alpha) { // Para Android
                updateCompass(360 - event.alpha);
            }
        };
        window.addEventListener('deviceorientation', deviceOrientationHandler);
        
        // Monitorar a posição GPS
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const missionCoords = missions[currentMission];
                
                const distance = getDistance(latitude, longitude, missionCoords.lat, missionCoords.lon);
                const bearing = getBearing(latitude, longitude, missionCoords.lat, missionCoords.lon);
                
                window.lastBearing = bearing; // Salva o rumo para o listener de orientação
                
                if (distance < 20) {
                    arriveAtMission();
                }
            },
            (err) => {
                console.error('Erro no GPS:', err);
                alert('Não foi possível obter sua localização. Verifique o GPS.');
            },
            { enableHighAccuracy: true }
        );
    }
    
    function updateCompass(deviceHeading) {
        if (typeof window.lastBearing !== 'undefined') {
            const rotation = window.lastBearing - deviceHeading;
            compassArrow.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
        }
    }

    // --- CHEGADA E INTERAÇÃO AR ---
    function arriveAtMission() {
        // Parar navegação
        navigator.geolocation.clearWatch(watchId);
        window.removeEventListener('deviceorientation', deviceOrientationHandler);
        compassArrow.style.display = 'none';
        
        // Vibrar celular
        if ('vibrate' in navigator) {
            navigator.vibrate([500, 200, 500]);
        }

        alert('Você chegou ao local! Procure o objeto com sua câmera e clique nele.');

        // Ativar a lógica de posicionamento de objeto
        setupARInteraction();
    }
    
    function setupARInteraction() {
        const mission = missions[currentMission];
        const modelSrc = mission.objectModel;
        
        let objectEntity = document.createElement(modelSrc === '#taco-model' ? 'a-image' : 'a-gltf-model');
        objectEntity.setAttribute('id', 'mission-object');
        objectEntity.setAttribute('src', modelSrc);
        objectEntity.setAttribute('class', 'clickable'); // Para o raycaster
        objectEntity.setAttribute('gesture-handler', ''); // Para arrastar/escalar se quiser
        
        // Ajustar escala inicial
        if (modelSrc === '#bike-model') {
            objectEntity.setAttribute('scale', '0.1 0.1 0.1');
        } else {
            objectEntity.setAttribute('scale', '0.5 0.5 0.5');
        }

        // Lógica para posicionar o objeto no chão ao tocar na tela
        scene.addEventListener('ar-hit-test-start', () => {
            console.log("Procurando superfícies...");
        }, { once: true });

        scene.addEventListener('ar-hit-test-achieved', (event) => {
            const hitPosition = event.detail.position;
            objectEntity.setAttribute('position', hitPosition);
            scene.appendChild(objectEntity);
            
            console.log("Objeto posicionado!");

            // Listener para coletar o objeto
            objectEntity.addEventListener('click', () => {
                collectObject(objectEntity);
            }, { once: true });

        }, { once: true }); // Posiciona apenas uma vez

        // Iniciar hit-test
        scene.emit('ar-hit-test-start');
    }

    function collectObject(objectEntity) {
        if (!objectEntity) return;

        // Remover o objeto da cena
        objectEntity.parentNode.removeChild(objectEntity);
        missions[currentMission].isCollected = true;
        
        // Missão 1 completa, iniciar próxima parte
        if (currentMission === 0) {
            callScreen.classList.add('active');
            dustinAudio.src = missions[0].completionAudio;

            const newDustinImage = dustinImage.cloneNode(true);
            dustinImage.parentNode.replaceChild(newDustinImage, dustinImage);
        
            newDustinImage.addEventListener('click', () => {
                dustinAudio.play();
            }, { once: true });
            
            dustinAudio.onended = () => {
                // Passa para a próxima missão
                currentMission = 1;
                callScreen.classList.remove('active');
                arView.classList.add('active');
                startNavigation();
            };
        } else if (currentMission === 1) {
            // Fim do Jogo
            arView.classList.remove('active');
            alert('Parabéns! Você coletou todos os itens e ajudou a salvar Hawkins!');
            startScreen.classList.add('active'); // Volta pra tela inicial
        }
    }


    // --- FUNÇÕES UTILITÁRIAS ---
    async function requestAllPermissions() {
        // Permissão de Orientação (necessário em alguns celulares)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response !== 'granted') {
                throw new Error('Permissão de orientação negada');
            }
        }
        // Permissão de câmera e GPS é solicitada pelo AR.js e Geolocation API automaticamente
        return Promise.resolve();
    }

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function toDegrees(radians) {
        return radians * 180 / Math.PI;
    }

    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Raio da Terra em metros
        const φ1 = toRadians(lat1);
        const φ2 = toRadians(lat2);
        const Δφ = toRadians(lat2 - lat1);
        const Δλ = toRadians(lon2 - lon1);

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function getBearing(lat1, lon1, lat2, lon2) {
        const φ1 = toRadians(lat1);
        const λ1 = toRadians(lon1);
        const φ2 = toRadians(lat2);
        const λ2 = toRadians(lon2);
        
        const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
                  Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
        const θ = Math.atan2(y, x);
        return (toDegrees(θ) + 360) % 360; // Rum em graus
    }
});
