document.addEventListener('DOMContentLoaded', async () => {
    const dropZone = document.getElementById('drop-zone');
    const fileUpload = document.getElementById('file-upload');
    const fileNameElement = document.getElementById('file-name');
    const fileContent = document.getElementById('file-content');
    const fileInfo = document.getElementById('file-info');
    const fileContainer = document.getElementById('file-input-container');
    const clearBtn = document.getElementById('clear-btn');

    let {mappingData, fileLoadSuccess, fileName, isDebugMode} = await loadFromMemory();
    let pageLoadSuccess = false;
    fileLoadSuccess = mappingData != null;

    //console.log("DOM LOADED");
    //console.log(mappingData, fileLoadSuccess, pageLoadSuccess, fileName, isDebugMode);

    fileUpload.addEventListener('change', handleFileSelect);

    // 드래그 앤 드롭 이벤트
    setupDragAndDrop();

    // 내용 지우기 버튼
    clearBtn.addEventListener('click', clearFile);

    await init();


    async function saveToMemory(cb) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'SET_DATA',
                ...{
                    mappingData: mappingData,
                    loadSuccess: pageLoadSuccess,
                    fileName: fileNameElement.textContent,
                    isDebugMode: isDebugMode
                }
            }, (response) => {
                resolve(response?.success ?? false);
                if (cb != null) cb();
            });
        });
    }

// 데이터 불러오기
    async function loadFromMemory(cb) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'GET_DATA'
            }, (response) => {
                resolve(response || {});
                if (cb != null) cb();
            });
        });
    }

    async function init() {
        showLoading(); // 로딩 시작

        pageLoadSuccess = await checkPage(fileNameElement?.textContent == null || fileNameElement?.textContent != '' ? fileNameElement?.textContent : fileName); // 파일명 전달
        checkForCrashlyticsStack();

        //console.log("await loadsuccess " + pageLoadSuccess);
        displayFile(fileNameElement?.textContent == null || fileNameElement?.textContent != '' ? fileNameElement?.textContent : fileName, mappingData != null ? JSON.stringify(mappingData) : '');
        await saveToMemory();

        hideLoading();

        showHUD(); // HUD 표시 추가
    }

    function showHUD() {
        const hudContainer = document.createElement('div');
        hudContainer.id = 'hud-container';
        hudContainer.style.padding = '10px';
        hudContainer.style.marginBottom = '15px';
        hudContainer.style.borderRadius = '4px';
        hudContainer.style.textAlign = 'center';
        hudContainer.style.fontWeight = 'bold';

        if (pageLoadSuccess && fileLoadSuccess) {
            hudContainer.textContent = '해독이 정상적으로 적용중입니다';
            hudContainer.style.backgroundColor = '#e6f7e6';
            hudContainer.style.color = '#2e7d32';
        } else {
            hudContainer.textContent = '파일이 없거나 잘못된 파일(앱버전, os 불일치), 혹은 잘못된 페이지입니다.';
            hudContainer.style.backgroundColor = '#ffebee';
            hudContainer.style.color = '#c62828';
        }

        // 기존 HUD 제거
        const existingHud = document.getElementById('hud-container');
        if (existingHud) {
            existingHud.remove();
        }

        // 컨테이너 최상단에 추가
        const container = document.querySelector('.container');
        container.insertBefore(hudContainer, container.firstChild);
    }

    function setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        dropZone.addEventListener('drop', handleDrop, false);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.classList.add('highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];

            if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                readFile(file);
            } else {
                displayError('텍스트 파일(.txt)만 지원합니다.');
            }
        }
    }

    async function readFile(file) {

        const reader = new FileReader();

        reader.onload = async (e) => {
            showLoading();

            const content = e.target.result;
            processMappingData(content);
            pageLoadSuccess = await checkPage(file.name); // 파일명 전달
            displayFile(file.name, content);
            checkForCrashlyticsStack();
            //console.log("로드완료")

            await saveToMemory();

            hideLoading()
            showHUD(); // HUD 표시 추가

        };

        reader.onerror = () => {
            displayError('파일을 읽는 중 오류가 발생했습니다.');
        };

        reader.readAsText(file);
    }

    // 로딩 표시 함수
    function showLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'flex';
    }

// 로딩 숨기기 함수
    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }

    function displayFile(name, content) {
        fileNameElement.textContent = `파일 이름: ${name}`;
        fileContent.textContent = content;
        fileInfo.style.display = fileLoadSuccess ? 'block' : 'none';
        fileContainer.style.display = fileLoadSuccess ? 'none' : 'block';

    }

    function displayError(message) {
        fileContent.textContent = message;
        fileInfo.style.display = 'block';
        // chrome.storage.local.remove(['savedFileName', 'savedFileContent']);
    }

    async function clearFile() {
        fileNameElement.textContent = '';
        fileContent.textContent = '';
        fileContainer.style.display = 'block';
        fileInfo.style.display = 'none';
        fileUpload.value = '';
        fileName = '';
        fileLoadSuccess = false;
        mappingData = null;
        saveToMemory();
        // chrome.storage.local.remove(['savedFileName', 'savedFileContent']);
        await checkPage(fileNameElement?.textContent == null || fileNameElement?.textContent != '' ? fileNameElement?.textContent : fileName); // 파일명 전달
        checkForCrashlyticsStack();
        displayFile('', '')
        showHUD(); // HUD 표시 추가

    }

    function processMappingData(content) {
        try {
            mappingData = JSON.parse(content);
            fileLoadSuccess = true;
        } catch (e) {
            console.error('매핑 데이터 파싱 실패:', e);
            mappingData = null;
        }
    }

    async function checkPage(fileName = '') {
        return new Promise((resolve) => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    func: (fileName) => {
                        // 1. 기존 상태 바 제거
                        const existingStatusBar = document.querySelector('.custom-status-bar');
                        if (existingStatusBar) existingStatusBar.remove();

                        // 2. 버전 정보 추출
                        const versionElement = document.querySelector('.session-build-version .header-item-text');
                        let version = '';
                        if (versionElement) {
                            const versionMatch = versionElement.textContent.trim().match(/\d+/);
                            version = versionMatch ? versionMatch[0] : '';
                        }

                        // 3. OS 정보 추출
                        const osIcon = document.querySelector('.session-os .platform-icon');
                        let os = 'unknown';
                        if (osIcon) {
                            const osName = (osIcon?.innerHTML ?? "") + "";
                            os = osName.includes('plat_android') ? 'Android' :
                                osName.includes('plat_ios') ? 'iOS' : 'unknown';
                        }

                        // 4. 파일명 파싱
                        const parseFileName = (fileName) => {
                            if (!fileName) return {store: '', version: ''};

                            let store = fileName.includes('GooglePlayStore') ? 'Android' :
                                fileName.includes('AppleAppStore') ? 'iOS' : '';

                            let fileVersion = '';
                            const versionMatch = fileName.match(/Ver (\d+\.\d+\.\d+)/);
                            if (versionMatch) {
                                const parts = versionMatch[1].split('.');
                                fileVersion = parts.length === 3 ?
                                    `${parts[0]}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}` : '';
                            }

                            return {store, version: fileVersion};
                        };

                        //console.log("파일명: " + fileName);
                        const fileData = parseFileName(fileName);

                        // 5. 검증 로직
                        const isVersionMatch = version && fileData.version && version === fileData.version;
                        const isOSMatch = os !== 'unknown' && fileData.store && os === fileData.store;
                        const isValid = fileName != null && isVersionMatch == true && isOSMatch == true;
                        //console.log("isValid => " + isValid);

                        // 6. 상태 바 생성
                        const statusBar = document.createElement('div');
                        statusBar.className = 'custom-status-bar';
                        Object.assign(statusBar.style, {
                            padding: '8px 16px',
                            backgroundColor: '#f5f5f5',
                            borderBottom: '1px solid #ddd',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '14px'
                        });

                        // 7. 페이지 정보 표시
                        const pageInfo = document.createElement('div');
                        pageInfo.textContent = `App Version: ${version} | OS: ${os}`;

                        // 8. 파일 정보 표시
                        const fileInfo = document.createElement('div');
                        fileInfo.textContent = fileName ?
                            `File: ${fileName}${fileData.store ? ` | Store: ${fileData.store}` : ''}${fileData.version ? ` | Ver: ${fileData.version}` : ''}` :
                            'No file loaded';

                        // 9. 상태 표시기 추가
                        const statusIndicator = document.createElement('span');
                        statusIndicator.style.marginLeft = '10px';
                        statusIndicator.style.fontWeight = 'bold';
                        statusIndicator.textContent = isValid ? '로드 성공' : '로드 실패';
                        statusIndicator.style.color = isValid ? '#4285f4' : '#ea4335';

                        //console.log("loadSuccess 할당");
                        pageLoadSuccess = isValid;

                        fileInfo.appendChild(statusIndicator);

                        statusBar.appendChild(pageInfo);
                        statusBar.appendChild(fileInfo);

                        // 10. 헤더에 상태 바 추가
                        const header = document.querySelector('.session-card-header');
                        if (header) header.prepend(statusBar);

                        // 디버깅 로그
                        //console.log('Validation:', {
                        //     appVersion: version,
                        //     fileVersion: fileData.version,
                        //     os: os,
                        //     store: fileData.store,
                        //     isValid: isValid
                        // });

                        return isValid; // 이 값을 resolve로 전달
                    },
                    args: [fileName.replace('파일 이름: ', '')]
                }, (results) => {
                    // executeScript의 콜백에서 결과 처리
                    const isValid = results?.[0]?.result ?? false;
                    //console.log("Resolve " + isValid);
                    resolve(isValid);
                });
            });
        });
    }

    function checkForCrashlyticsStack() {
        if (fileLoadSuccess == false || pageLoadSuccess == false) {
            return;
        }
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: (mappingData) => {
                    if (mappingData == null) {
                        //console.log("맵핑 데이터 없어서 리턴");
                        return;
                    }


                    // 매핑 데이터 파싱
                    let parsedMapping = null;
                    try {
                        parsedMapping = JSON.parse(mappingData);
                        if (parsedMapping?.MemberTyp_Mapping?.Method?.Mapping == null) {
                            //console.log("맵핑 데이터 없어서 리턴2");
                            return;
                        }
                    } catch (e) {
                        console.error('매핑 데이터 파싱 실패:', e);
                        return;
                    }


                    const osIcon = document.querySelector('.session-os .platform-icon');
                    const isiOS = osIcon?.innerHTML.includes('plat_ios');

                    function parseAndroidStack(frame) {
                        const contextDiv = frame.querySelector('.context-cell > div');
                        if (!contextDiv) return null;

                        const text = contextDiv.textContent.trim();
                        const lastParenIndex = text.lastIndexOf('(');

                        // 1. className 추출: 마지막 ( ~ ) 사이 내용에서 + 앞부분
                        const className = extractClassName(text);

                        // 2. methodName 추출
                        let methodName = '';
                        if (text.includes('+')) {
                            // +가 있는 경우: + ~ ( 사이
                            const plusIndex = text.indexOf('+');
                            methodName = text.slice(plusIndex + 1, lastParenIndex).trim();
                        } else {
                            // +가 없는 경우: 마지막 . ~ ( 사이
                            const lastDotIndex = text.lastIndexOf('.', lastParenIndex);
                            methodName = text.slice(lastDotIndex + 1, lastParenIndex).trim();
                        }

                        return { methodName, className };
                    }

// className 추출 헬퍼 함수
                    function extractClassName(text) {
                        const betweenParen = text.slice(
                            text.lastIndexOf('(') + 1,
                            text.lastIndexOf(')')
                        ).trim();
                        return betweenParen.split('+')[0]; // +가 없으면 전체 반환
                    }
// methodName 추출 함수
                    function extractMethodName(text) {
                        const plusIndex = text.indexOf('+');
                        const lastDotIndex = text.lastIndexOf('.');
                        const lastParenIndex = text.lastIndexOf('(');

                        if (plusIndex !== -1) {
                            // '+'가 있는 경우: '+'부터 '('까지
                            return text.substring(plusIndex + 1, lastParenIndex).trim();
                        } else if (lastDotIndex !== -1) {
                            // '+'는 없고 '.'이 있는 경우: 마지막 '.'부터 '('까지
                            return text.substring(lastDotIndex + 1, lastParenIndex).trim();
                        }
                        return ''; // 둘 다 없는 경우
                    }

                    function parseiOSStack(frame) {
                        const symbolDiv = frame.querySelector('.frame-symbol');
                        const fileLine = frame.querySelector('.frame-file-line span');

                        console.log("sym " +symbolDiv?.textContent);
                        console.log("fileLine " +fileLine?.textContent);
                        let className = fileLine?.textContent.trim();
                        let methodName = symbolDiv?.textContent.trim();

                        if(className.includes('+')){
                            methodName += '.'+className.split('+')[1].trim();
                            className = className.split('+')[0].trim();

                        }

                        return {
                            methodName: methodName,
                            className: className
                        };
                    }


                    // DOM 조작
                    document.querySelectorAll('c9s-stack-frame').forEach(frame => {
                        const contextDiv = frame.querySelector('.context-cell > div');
                        if (!contextDiv) return;

                        const originalText = contextDiv.textContent.trim();
                        // const methodName = extractMethodName(originalText);
                        // const className = extractClassName(originalText);

                        const {methodName, className} = isiOS ?
                            parseiOSStack(frame) :
                            parseAndroidStack(frame);

                        //console.log("@@  " + methodName, className);

                        if (!methodName || !className) return;

                        // 변환된 텍스트 찾기
                        let translatedText = '';
                        if (parsedMapping) {
                            methodName.split('.').forEach(methodName => {
                                var exist = false;
                                console.log("TARGET : M" + methodName + " / " + className);

                                for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Method.Mapping)) {
                                    if (value === methodName && key.includes(className)) {
                                        translatedText += (key + '\n');
                                        exist = true;
                                        break;
                                    }
                                }

                                if (exist == false) {
                                    for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Event.Mapping)) {
                                        if (value === methodName && key.includes(className)) {
                                            translatedText += key + '\n';
                                            exist = true;
                                            break;
                                        }
                                    }

                                }

                                if (exist == false) {

                                    for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Type.Mapping)) {
                                        if (value === methodName && key.includes(className)) {
                                            translatedText += key + '\n';
                                            exist = true;
                                            break;
                                        }
                                    }
                                }

                                if (exist == false) {
                                    for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Field.Mapping)) {
                                        if (value === methodName && key.includes(className)) {
                                            translatedText += key + '\n';
                                            exist = true;
                                            break;
                                        }
                                    }
                                }

                                if (exist == false) {
                                    for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Property.Mapping)) {
                                        if (value === methodName && key.includes(className)) {
                                            translatedText += key + '\n';
                                            exist = true;
                                            break;
                                        }
                                    }
                                }


                            })


                            if (translatedText == '') {
                                for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Method.Mapping)) {
                                    if (value === methodName) {
                                        translatedText += (key + '\n');
                                    }
                                }

                                for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Event.Mapping)) {
                                    if (value === methodName) {
                                        translatedText += key + '\n';
                                    }
                                }

                                for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Type.Mapping)) {
                                    if (value === methodName) {
                                        translatedText += key + '\n';
                                    }
                                }
                                for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Field.Mapping)) {
                                    if (value === methodName) {
                                        translatedText += key + '\n';
                                    }
                                }

                                for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Property.Mapping)) {
                                    if (value === methodName) {
                                        translatedText += key + '\n';
                                    }
                                }
                                if (translatedText == '') {
                                    translatedText = 'Not Found';
                                }
                            }
                        }

                        // 기존 변환 결과 제거 또는 업데이트
                        let translationSpan = contextDiv.querySelector('.stack-translation');
                        if (!translationSpan) {
                            translationSpan = document.createElement('span');
                            translationSpan.className = 'stack-translation';
                            contextDiv.appendChild(document.createElement('br'));
                            contextDiv.appendChild(translationSpan);
                        } else {
                        }

                        // 내용 업데이트 (덮어쓰기)
                        translationSpan.textContent = `Translated => ${translatedText}`;
                        if (translationSpan) {
                            translationSpan.innerHTML = translationSpan.textContent.replaceAll(/</g, '&lt;').replaceAll(/>/g, '&gt;').replaceAll(/\n/g, '<br>');
                        }
                        //console.log(parsedMapping);
                        // if(loadSuccess == false){
                        //     translationSpan.textContent = '로드 실패';
                        // }
                    });
                },
                args: [mappingData ? JSON.stringify(mappingData) : '{}']
            });
        });
    }

});