document.addEventListener('DOMContentLoaded', function () {
    const solveBtn = document.getElementById('solve-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const solutionDisplay = document.getElementById('solution-display');
    const copyBtn = document.getElementById('copy-btn');

    // Load saved API key if it exists
    chrome.storage.sync.get(['openai_api_key'], function(result) {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    });

    if (solveBtn && apiKeyInput) {
        solveBtn.addEventListener('click', async () => {
            const openai_api_key = apiKeyInput.value.trim();

            if (!openai_api_key) {
                alert('Please enter your OpenAI API key.');
                return;
            }

            // Save the API key
            chrome.storage.sync.set({ openai_api_key: openai_api_key }, function() {
                console.log('API key saved');
            });

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Inject the script and capture the result
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {

                    // Extracting problem title
                    const title = document.querySelector('a.no-underline.truncate.cursor-text')?.innerText || "Title not found";

                    // Extracting problem content (description)
                    const content = document.querySelector('div.elfjS')?.innerText || "Content not found";

                    // Extracting hints
                    let hints = [];
                    document.querySelectorAll('div.text-body.elfjS').forEach(hint => {
                        if (hint.innerText && hint.innerText.trim().length > 0) {
                            hints.push(hint.innerText.trim());
                        }
                    });

                    // Extracting selected language from the button
                    const languageButton = document.querySelector('.rounded.items-center.inline-flex.bg-transparent.dark\\:bg-dark-transparent.text-text-secondary');
                    let currentLanguage = "Language not found";
                    if (languageButton) {
                        currentLanguage = languageButton.childNodes[0].textContent.trim();  // Access the language text
                    }

                    // Extracting code template from the Monaco editor view-lines
                    let languageTemplate = "Language template not found";
                    try {
                        const viewLines = document.querySelectorAll('.view-lines .view-line');
                        if (viewLines.length > 0) {
                            languageTemplate = Array.from(viewLines)
                                .map(line => line.innerText.trim())
                                .join('\n'); // Join lines to form the complete code
                        }
                    } catch (error) {
                        console.error("Error accessing Monaco editor:", error);
                    }

                    console.log('Extracted data:', { title, content, hints, languageTemplate, currentLanguage });

                    // Return all extracted information
                    return {
                        title,
                        content,
                        hints,
                        languageTemplate,
                        currentLanguage
                    };
                }
            });

            const problemDetails = result.result;

            // make openai api call to generate solution
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openai_api_key}` // Use the API key from input
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a helpful assistant that generates solutions to LeetCode problems.'
                            },
                            {
                                role: 'user',
                                content: `Generate a solution to the problem: ${problemDetails.title}. The problem description is: ${problemDetails.content}. The hints are: ${problemDetails.hints.join(', ')}. The current language is: ${problemDetails.currentLanguage}. The language template is: ${problemDetails.languageTemplate}. Provide all necessary functions, classes, and imports.`
                            }
                        ],
                        temperature: 0
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseData = await response.json();

                const solution = responseData.choices?.[0]?.message?.content?.trim();

                // Display the solution
                const solutionDisplay = document.getElementById('solution-display');
                if (solutionDisplay) {
                    setTimeout(() => {
                        displaySolution(solution);
                    }, 100);
                    solutionDisplay.style.display = 'block';
                } else {
                    console.error('Solution display element not found');
                }

                // Optionally, disable the solve button to prevent multiple submissions
                solveBtn.disabled = true;
            } catch (error) {
                console.error('Error generating solution:', error);
                // Display error message to user
                const solutionDisplay = document.getElementById('solution-display');
                if (solutionDisplay) {
                    solutionDisplay.textContent = `Error generating solution: ${error.message}`;
                    solutionDisplay.style.display = 'block';
                }
            }
        });
    } else {
        console.error('Solve button or API key input not found.');
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const codeBlocks = extractCodeBlocks(solutionDisplay.innerHTML);
            if (codeBlocks.length > 0) {
                const codeText = codeBlocks.join('\n\n');
                navigator.clipboard.writeText(codeText).then(() => {
                    // Visual feedback without alert
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.backgroundColor = '#45a049';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.backgroundColor = '';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy code: ', err);
                });
            } else {
                console.log('No code found to copy.');
            }
        });
    }
});

function displaySolution(solution) {
    const solutionDisplay = document.getElementById('solution-display');
    const copyBtn = document.getElementById('copy-btn');
    if (solutionDisplay) {
        solutionDisplay.innerHTML = marked.parse(solution);
        solutionDisplay.style.display = 'block';
        if (copyBtn) {
            copyBtn.style.display = 'block';
        }
    }
}

function extractCodeBlocks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const codeElements = doc.querySelectorAll('pre code');
    return Array.from(codeElements).map(el => el.textContent);
}