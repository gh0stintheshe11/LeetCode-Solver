const openai_api_key = "";

document.addEventListener('DOMContentLoaded', function () {
    const solveBtn = document.getElementById('solve-btn');

    if (solveBtn) {
        solveBtn.addEventListener('click', async () => {

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
                        'Authorization': `Bearer ${openai_api_key}`
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
        console.error('Solve button not found.');
    }
});

function displaySolution(solution) {
    const solutionDisplay = document.getElementById('solution-display');
    const codeDisplay = document.getElementById('code-display');
    const copyBtn = document.getElementById('copy-btn');
    const codeSection = document.getElementById('code-section');

    if (typeof marked !== 'undefined') {
        solutionDisplay.innerHTML = marked.parse(solution);
        
        // Extract code from the markdown
        const codeMatch = solution.match(/```[\s\S]*?```/);
        if (codeMatch) {
            let code = codeMatch[0].replace(/```[\s\S]*?\n/, '').replace(/```$/, '').trim();
            codeDisplay.textContent = code;
            codeSection.style.display = 'block';
            
            // Set up copy button
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(code).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy Code';
                    }, 2000);
                });
            };
        } else {
            codeSection.style.display = 'none';
        }
    } else {
        console.error('Marked library not loaded');
        solutionDisplay.textContent = solution;
        codeSection.style.display = 'none';
    }
}