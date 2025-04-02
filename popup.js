document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileUpload = document.getElementById('file-upload');
    const fileName = document.getElementById('file-name');
    const fileContent = document.getElementById('file-content');
    const fileInfo = document.getElementById('file-info');
    const clearBtn = document.getElementById('clear-btn');
    let mappingData = null;
    let os = null;
    let loadSuccess = false;
  
    // ����� ���� ���� �ҷ�����
    loadSavedFile();
  
    // ���� ���ε� ��ư �̺�Ʈ
    fileUpload.addEventListener('change', handleFileSelect);
  
    // �巡�� �� ��� �̺�Ʈ
    setupDragAndDrop();
  
    // ���� ����� ��ư
    clearBtn.addEventListener('click', clearFile);
  
    // DOM �ε� �� ũ���ø�ƽ ���� ����
    checkForCrashlyticsStack();
    checkPage(fileName.textContent); // ���ϸ� ����
  
    function loadSavedFile() {
      chrome.storage.local.get(['savedFileName', 'savedFileContent'], (result) => {
        if (result.savedFileName && result.savedFileContent) {
          displayFile(result.savedFileName, result.savedFileContent);
          processMappingData(result.savedFileContent);
          checkPage(fileName.textContent); // ���ϸ� ����
          checkForCrashlyticsStack();
        }
      });
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
  
    function readFile(file) {
      const reader = new FileReader();
  
      reader.onload = (e) => {
        const content = e.target.result;
        saveAndDisplayFile(file.name, content);
        processMappingData(content);
        checkPage(file.name); // ���ϸ� ����
        checkForCrashlyticsStack();
        console.log("�ε�Ϸ�")

      };
  
      reader.onerror = () => {
        displayError('������ �д� �� ������ �߻��߽��ϴ�.');
      };
  
      reader.readAsText(file);
    }
  
    function saveAndDisplayFile(name, content) {
      chrome.storage.local.set({
        savedFileName: name,
        savedFileContent: content
      }, () => {
        displayFile(name, content);
      });
    }
  
    function displayFile(name, content) {
      fileName.textContent = `���� �̸�: ${name}`;
      fileContent.textContent = content;
      fileInfo.style.display = 'block';
    }
  
    function displayError(message) {
      fileContent.textContent = message;
      fileInfo.style.display = 'block';
      chrome.storage.local.remove(['savedFileName', 'savedFileContent']);
    }
  
    function clearFile() {
      fileName.textContent = '';
      fileContent.textContent = '';
      fileInfo.style.display = 'none';
      fileUpload.value = '';
      mappingData = null;
      chrome.storage.local.remove(['savedFileName', 'savedFileContent']);
      checkPage(fileName.textContent); // ���ϸ� ����
      checkForCrashlyticsStack();

    }
  
    function processMappingData(content) {
      try {
        mappingData = JSON.parse(content);
      } catch (e) {
        console.error('���� ������ �Ľ� ����:', e);
        mappingData = null;
      }
    }
  
    function checkPage(fileName = '') {
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
                if (!fileName) return { store: '', version: '' };
      
                let store = fileName.includes('GooglePlayStore') ? 'Android' :
                           fileName.includes('AppleAppStore') ? 'iOS' : '';
      
                let fileVersion = '';
                const versionMatch = fileName.match(/Ver (\d+\.\d+\.\d+)/);
                if (versionMatch) {
                  const parts = versionMatch[1].split('.');
                  fileVersion = parts.length === 3 ? 
                    `${parts[0]}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}` : '';
                }
      
                return { store, version: fileVersion };
              };
      
              console.log("���ϸ�: "+fileName);
              const fileData = parseFileName(fileName);
              
              // 5. ���� ����
              const isVersionMatch = version && fileData.version && version === fileData.version;
              const isOSMatch = os !== 'unknown' && fileData.store && os === fileData.store;
              const isValid = fileName && isVersionMatch && isOSMatch;
      
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
      
              loadSuccess = isValid;

              fileInfo.appendChild(statusIndicator);
      
              statusBar.appendChild(pageInfo);
              statusBar.appendChild(fileInfo);
      
              // 10. ����� ���� �� �߰�
              const header = document.querySelector('.session-card-header');
              if (header) header.prepend(statusBar);
      
              // ����� �α�
              console.log('Validation:', {
                appVersion: version,
                fileVersion: fileData.version,
                os: os,
                store: fileData.store,
                isValid: isValid
              });
            },
            args: [fileName.replace('���� �̸�: ', '')]
          });
        });
      }
    function checkForCrashlyticsStack() {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            func: (mappingData) => {
                const osIcon = document.querySelector('.session-os .platform-icon');
                const isiOS = osIcon?.innerHTML.includes('plat_ios');

                function parseAndroidStack(frame) {
                    console.log("do parse and")
                    const contextDiv = frame.querySelector('.context-cell > div');
                    if (!contextDiv) return null;
                    
                    const text = contextDiv.textContent.trim();

                    
                    const methodMatch = text.match(/([^\s]+)\s*\(/);
                    const classMatch = text.match(/\(([^)]+)\)/);

                    console.log("method::"+methodMatch);
                    
                    return {
                      methodName: methodMatch ? methodMatch[1].split('.').pop() : null,
                      className: classMatch ? classMatch[1].split('+')[0] : null
                    };
                  }

                  function parseiOSStack(frame) {
                    const symbolDiv = frame.querySelector('.frame-symbol');
                    const fileLine = frame.querySelector('.frame-file-line span');
                    
                    return {
                      methodName: symbolDiv?.textContent.trim(),
                      className: fileLine?.textContent.trim()
                    };
                  }

              // ���� ������ �Ľ�
              let parsedMapping = null;
              try {
                parsedMapping = JSON.parse(mappingData);
              } catch (e) {
                console.error('���� ������ �Ľ� ����:', e);
              }
      
              // DOM ����
              document.querySelectorAll('c9s-stack-frame').forEach(frame => {
                const contextDiv = frame.querySelector('.context-cell > div');
                if (!contextDiv) return;
      
                const originalText = contextDiv.textContent.trim();
                // const methodName = extractMethodName(originalText);
                // const className = extractClassName(originalText);

                const { methodName, className } = isiOS ? 
                parseiOSStack(frame) : 
                parseAndroidStack(frame);

                console.log(methodName, className);
      
                if (!methodName || !className) return;
      
                // ��ȯ�� �ؽ�Ʈ ã��
                let translatedText = 'Not found';
                if (parsedMapping) {
                    var exist = false;

                  for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Method.Mapping)) {
                    if (value === methodName && key.includes(className)) {
                      translatedText = key;
                      exist = true;
                      break;
                    }
                  }

                  if(exist == false){
                    translatedText = '';

                    for (const [key, value] of Object.entries(parsedMapping.MemberTyp_Mapping.Method.Mapping)) {
                        if (value === methodName) {
                            translatedText += (key+'\n');
                            exist = true;
                        }
                      }
                  }

                  if(exist == false){
                    translatedText = 'Not Found';
                  }
                }
      
                // ���� ��ȯ ��� ���� �Ǵ� ������Ʈ
                let translationSpan = contextDiv.querySelector('.stack-translation');
                if (!translationSpan) {
                    console.log("��� ���� ����");
                  translationSpan = document.createElement('span');
                  translationSpan.className = 'stack-translation';
                  contextDiv.appendChild(document.createElement('br'));
                  contextDiv.appendChild(translationSpan);
                }
                else {
                    console.log("�̹�������")
                }
                
                // ���� ������Ʈ (�����)
                translationSpan.textContent = `Translated => ${translatedText}`;
                if(loadSuccess == false){
                    translationSpan.textContent = '�ε� ����';
                }
              });
            },
            args: [mappingData ? JSON.stringify(mappingData) : '{}']
          });
        });
      }
  
    function generateTranslatedStack(stackInfo) {
      if (!mappingData) return '';
  
      return stackInfo.map(item => {
        const { original, className, methodName } = item;
        let translated = 'Not found';
        
        // ���� �����Ϳ��� �ش� �޼���� �˻�
        for (const [key, value] of Object.entries(mappingData)) {
          if (value === methodName && key.includes(className)) {
            translated = key;
            break;
          }
        }
        
        return `${original} -- Translated => "${translated}"`;
      }).join('<br>');
    }
  });