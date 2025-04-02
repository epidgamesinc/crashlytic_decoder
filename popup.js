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
  
    // 저장된 파일 내용 불러오기
    loadSavedFile();
  
    // 파일 업로드 버튼 이벤트
    fileUpload.addEventListener('change', handleFileSelect);
  
    // 드래그 앤 드롭 이벤트
    setupDragAndDrop();
  
    // 내용 지우기 버튼
    clearBtn.addEventListener('click', clearFile);
  
    // DOM 로드 시 크래시리틱 스택 감지
    checkForCrashlyticsStack();
    checkPage(fileName.textContent); // 파일명 전달
  
    function loadSavedFile() {
      chrome.storage.local.get(['savedFileName', 'savedFileContent'], (result) => {
        if (result.savedFileName && result.savedFileContent) {
          displayFile(result.savedFileName, result.savedFileContent);
          processMappingData(result.savedFileContent);
          checkPage(fileName.textContent); // 파일명 전달
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
          displayError('텍스트 파일(.txt)만 지원합니다.');
        }
      }
    }
  
    function readFile(file) {
      const reader = new FileReader();
  
      reader.onload = (e) => {
        const content = e.target.result;
        saveAndDisplayFile(file.name, content);
        processMappingData(content);
        checkPage(file.name); // 파일명 전달
        checkForCrashlyticsStack();
        console.log("로드완료")

      };
  
      reader.onerror = () => {
        displayError('파일을 읽는 중 오류가 발생했습니다.');
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
      fileName.textContent = `파일 이름: ${name}`;
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
      checkPage(fileName.textContent); // 파일명 전달
      checkForCrashlyticsStack();

    }
  
    function processMappingData(content) {
      try {
        mappingData = JSON.parse(content);
      } catch (e) {
        console.error('매핑 데이터 파싱 실패:', e);
        mappingData = null;
      }
    }
  
    function checkPage(fileName = '') {
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
      
              console.log("파일명: "+fileName);
              const fileData = parseFileName(fileName);
              
              // 5. 검증 로직
              const isVersionMatch = version && fileData.version && version === fileData.version;
              const isOSMatch = os !== 'unknown' && fileData.store && os === fileData.store;
              const isValid = fileName && isVersionMatch && isOSMatch;
      
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
      
              loadSuccess = isValid;

              fileInfo.appendChild(statusIndicator);
      
              statusBar.appendChild(pageInfo);
              statusBar.appendChild(fileInfo);
      
              // 10. 헤더에 상태 바 추가
              const header = document.querySelector('.session-card-header');
              if (header) header.prepend(statusBar);
      
              // 디버깅 로그
              console.log('Validation:', {
                appVersion: version,
                fileVersion: fileData.version,
                os: os,
                store: fileData.store,
                isValid: isValid
              });
            },
            args: [fileName.replace('파일 이름: ', '')]
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

              // 매핑 데이터 파싱
              let parsedMapping = null;
              try {
                parsedMapping = JSON.parse(mappingData);
              } catch (e) {
                console.error('매핑 데이터 파싱 실패:', e);
              }
      
              // DOM 조작
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
      
                // 변환된 텍스트 찾기
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
      
                // 기존 변환 결과 제거 또는 업데이트
                let translationSpan = contextDiv.querySelector('.stack-translation');
                if (!translationSpan) {
                    console.log("없어서 새로 만듬");
                  translationSpan = document.createElement('span');
                  translationSpan.className = 'stack-translation';
                  contextDiv.appendChild(document.createElement('br'));
                  contextDiv.appendChild(translationSpan);
                }
                else {
                    console.log("이미존재함")
                }
                
                // 내용 업데이트 (덮어쓰기)
                translationSpan.textContent = `Translated => ${translatedText}`;
                if(loadSuccess == false){
                    translationSpan.textContent = '로드 실패';
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
        
        // 매핑 데이터에서 해당 메서드명 검색
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