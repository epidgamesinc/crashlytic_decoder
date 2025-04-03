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

    // �巡�� �� ��� �̺�Ʈ
    setupDragAndDrop();

    // ���� ����� ��ư
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

// ������ �ҷ�����
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
        showLoading(); // �ε� ����

        pageLoadSuccess = await checkPage(fileNameElement?.textContent == null || fileNameElement?.textContent != '' ? fileNameElement?.textContent : fileName); // ���ϸ� ����
        checkForCrashlyticsStack();

        //console.log("await loadsuccess " + pageLoadSuccess);
        displayFile(fileNameElement?.textContent == null || fileNameElement?.textContent != '' ? fileNameElement?.textContent : fileName, mappingData != null ? JSON.stringify(mappingData) : '');
        await saveToMemory();

        hideLoading();

        showHUD(); // HUD ǥ�� �߰�
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
            hudContainer.textContent = '�ص��� ���������� �������Դϴ�';
            hudContainer.style.backgroundColor = '#e6f7e6';
            hudContainer.style.color = '#2e7d32';
        } else {
            hudContainer.textContent = '������ ���ų� �߸��� ����(�۹���, os ����ġ), Ȥ�� �߸��� �������Դϴ�.';
            hudContainer.style.backgroundColor = '#ffebee';
            hudContainer.style.color = '#c62828';
        }

        // ���� HUD ����
        const existingHud = document.getElementById('hud-container');
        if (existingHud) {
            existingHud.remove();
        }

        // �����̳� �ֻ�ܿ� �߰�
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
                displayError('�ؽ�Ʈ ����(.txt)�� �����մϴ�.');
            }
        }
    }

    async function readFile(file) {

        const reader = new FileReader();

        reader.onload = async (e) => {
            showLoading();

            const content = e.target.result;
            processMappingData(content);
            pageLoadSuccess = await checkPage(file.name); // ���ϸ� ����
            displayFile(file.name, content);
            checkForCrashlyticsStack();
            //console.log("�ε�Ϸ�")

            await saveToMemory();

            hideLoading()
            showHUD(); // HUD ǥ�� �߰�

        };

        reader.onerror = () => {
            displayError('������ �д� �� ������ �߻��߽��ϴ�.');
        };

        reader.readAsText(file);
    }

    // �ε� ǥ�� �Լ�
    function showLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'flex';
    }

// �ε� ����� �Լ�
    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }

    function displayFile(name, content) {
        fileNameElement.textContent = `���� �̸�: ${name}`;
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
        await checkPage(fileNameElement?.textContent == null || fileNameElement?.textContent != '' ? fileNameElement?.textContent : fileName); // ���ϸ� ����
        checkForCrashlyticsStack();
        displayFile('', '')
        showHUD(); // HUD ǥ�� �߰�

    }

    function processMappingData(content) {
        try {
            mappingData = JSON.parse(content);
            fileLoadSuccess = true;
        } catch (e) {
            console.error('���� ������ �Ľ� ����:', e);
            mappingData = null;
        }
    }

    async function checkPage(fileName = '') {
        return new Promise((resolve) => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    func: (fileName) => {
                        // 1. ���� ���� �� ����
                        const existingStatusBar = document.querySelector('.custom-status-bar');
                        if (existingStatusBar) existingStatusBar.remove();

                        // 2. ���� ���� ����
                        const versionElement = document.querySelector('.session-build-version .header-item-text');
                        let version = '';
                        if (versionElement) {
                            const versionMatch = versionElement.textContent.trim().match(/\d+/);
                            version = versionMatch ? versionMatch[0] : '';
                        }

                        // 3. OS ���� ����
                        const osIcon = document.querySelector('.session-os .platform-icon');
                        let os = 'unknown';
                        if (osIcon) {
                            const osName = (osIcon?.innerHTML ?? "") + "";
                            os = osName.includes('plat_android') ? 'Android' :
                                osName.includes('plat_ios') ? 'iOS' : 'unknown';
                        }

                        // 4. ���ϸ� �Ľ�
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

                        //console.log("���ϸ�: " + fileName);
                        const fileData = parseFileName(fileName);

                        // 5. ���� ����
                        const isVersionMatch = version && fileData.version && version === fileData.version;
                        const isOSMatch = os !== 'unknown' && fileData.store && os === fileData.store;
                        const isValid = fileName != null && isVersionMatch == true && isOSMatch == true;
                        //console.log("isValid => " + isValid);

                        // 6. ���� �� ����
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

                        // 7. ������ ���� ǥ��
                        const pageInfo = document.createElement('div');
                        pageInfo.textContent = `App Version: ${version} | OS: ${os}`;

                        // 8. ���� ���� ǥ��
                        const fileInfo = document.createElement('div');
                        fileInfo.textContent = fileName ?
                            `File: ${fileName}${fileData.store ? ` | Store: ${fileData.store}` : ''}${fileData.version ? ` | Ver: ${fileData.version}` : ''}` :
                            'No file loaded';

                        // 9. ���� ǥ�ñ� �߰�
                        const statusIndicator = document.createElement('span');
                        statusIndicator.style.marginLeft = '10px';
                        statusIndicator.style.fontWeight = 'bold';
                        statusIndicator.textContent = isValid ? '�ε� ����' : '�ε� ����';
                        statusIndicator.style.color = isValid ? '#4285f4' : '#ea4335';

                        //console.log("loadSuccess �Ҵ�");
                        pageLoadSuccess = isValid;

                        fileInfo.appendChild(statusIndicator);

                        statusBar.appendChild(pageInfo);
                        statusBar.appendChild(fileInfo);

                        // 10. ����� ���� �� �߰�
                        const header = document.querySelector('.session-card-header');
                        if (header) header.prepend(statusBar);

                        // ����� �α�
                        //console.log('Validation:', {
                        //     appVersion: version,
                        //     fileVersion: fileData.version,
                        //     os: os,
                        //     store: fileData.store,
                        //     isValid: isValid
                        // });

                        return isValid; // �� ���� resolve�� ����
                    },
                    args: [fileName.replace('���� �̸�: ', '')]
                }, (results) => {
                    // executeScript�� �ݹ鿡�� ��� ó��
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
                        //console.log("���� ������ ��� ����");
                        return;
                    }


                    // ���� ������ �Ľ�
                    let parsedMapping = null;
                    try {
                        parsedMapping = JSON.parse(mappingData);
                        if (parsedMapping?.MemberTyp_Mapping?.Method?.Mapping == null) {
                            //console.log("���� ������ ��� ����2");
                            return;
                        }
                    } catch (e) {
                        console.error('���� ������ �Ľ� ����:', e);
                        return;
                    }


                    const osIcon = document.querySelector('.session-os .platform-icon');
                    const isiOS = osIcon?.innerHTML.includes('plat_ios');

                    function parseAndroidStack(frame) {
                        const contextDiv = frame.querySelector('.context-cell > div');
                        if (!contextDiv) return null;

                        const text = contextDiv.textContent.trim();
                        const lastParenIndex = text.lastIndexOf('(');

                        // 1. className ����: ������ ( ~ ) ���� ���뿡�� + �պκ�
                        const className = extractClassName(text);

                        // 2. methodName ����
                        let methodName = '';
                        if (text.includes('+')) {
                            // +�� �ִ� ���: + ~ ( ����
                            const plusIndex = text.indexOf('+');
                            methodName = text.slice(plusIndex + 1, lastParenIndex).trim();
                        } else {
                            // +�� ���� ���: ������ . ~ ( ����
                            const lastDotIndex = text.lastIndexOf('.', lastParenIndex);
                            methodName = text.slice(lastDotIndex + 1, lastParenIndex).trim();
                        }

                        return { methodName, className };
                    }

// className ���� ���� �Լ�
                    function extractClassName(text) {
                        const betweenParen = text.slice(
                            text.lastIndexOf('(') + 1,
                            text.lastIndexOf(')')
                        ).trim();
                        return betweenParen.split('+')[0]; // +�� ������ ��ü ��ȯ
                    }
// methodName ���� �Լ�
                    function extractMethodName(text) {
                        const plusIndex = text.indexOf('+');
                        const lastDotIndex = text.lastIndexOf('.');
                        const lastParenIndex = text.lastIndexOf('(');

                        if (plusIndex !== -1) {
                            // '+'�� �ִ� ���: '+'���� '('����
                            return text.substring(plusIndex + 1, lastParenIndex).trim();
                        } else if (lastDotIndex !== -1) {
                            // '+'�� ���� '.'�� �ִ� ���: ������ '.'���� '('����
                            return text.substring(lastDotIndex + 1, lastParenIndex).trim();
                        }
                        return ''; // �� �� ���� ���
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


                    // DOM ����
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

                        // ��ȯ�� �ؽ�Ʈ ã��
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

                        // ���� ��ȯ ��� ���� �Ǵ� ������Ʈ
                        let translationSpan = contextDiv.querySelector('.stack-translation');
                        if (!translationSpan) {
                            translationSpan = document.createElement('span');
                            translationSpan.className = 'stack-translation';
                            contextDiv.appendChild(document.createElement('br'));
                            contextDiv.appendChild(translationSpan);
                        } else {
                        }

                        // ���� ������Ʈ (�����)
                        translationSpan.textContent = `Translated => ${translatedText}`;
                        if (translationSpan) {
                            translationSpan.innerHTML = translationSpan.textContent.replaceAll(/</g, '&lt;').replaceAll(/>/g, '&gt;').replaceAll(/\n/g, '<br>');
                        }
                        //console.log(parsedMapping);
                        // if(loadSuccess == false){
                        //     translationSpan.textContent = '�ε� ����';
                        // }
                    });
                },
                args: [mappingData ? JSON.stringify(mappingData) : '{}']
            });
        });
    }

});