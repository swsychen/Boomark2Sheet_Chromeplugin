
var spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Replace with your actual spreadsheet ID
var range = 'bookmarks!A:B'; // Adjust based on your needs


function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, function(token) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(token);
            }
        });
    });
}

// Adjusted to initiate the writing process after fetching bookmarks
function fetchAndPrintBookmarks() {
    let bmaks_arr = [["ID", "Name", "URL"]];
    let rowId = 1;
    chrome.bookmarks.getTree(function(bookmarks) { 
        printBookmarks(bookmarks,bmaks_arr, rowId);
        console.log("Updated bookmarks array:", bmaks_arr);
        // Now, get auth token and write to sheet
        getAuthToken().then(token => {
            writeToSheet(bmaks_arr, token);
        }).catch(error => {
            console.error("Failed to get auth token:", error);
        });
    });
}

function printBookmarks(bookmarkNodes, bmaks_arr, rowId) {
    bookmarkNodes.forEach(node => {
        if (node.children) {
            // Pass rowId without incrementing it here because it's not a leaf node
            rowId = printBookmarks(node.children, bmaks_arr, rowId);
        } else {
            if(node.title && node.url) { // Check both title and URL are present
                console.log(rowId, node.title, node.url);
                bmaks_arr.push([rowId, node.title, node.url]);
                rowId++; // Increment rowId here for each bookmark processed
            }
        }
    });
    return rowId; // Return the updated rowId for subsequent operations
}


function clearSheet(spreadsheetId, range, accessToken) {
    return new Promise((resolve, reject) => {
        var clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
        var params = {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        };
        fetch(clearUrl, params)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok, status: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error("Error clearing sheet:", data.error);
                    reject(data.error); // Reject the promise if there's an API error
                } else {
                    console.log("Success clearing sheet:", data);
                    resolve(); // Resolve the promise upon successful clearing
                }
            })
            .catch(error => {
                console.error('Error clearing sheet:', error);
                reject(error); // Reject the promise on fetch errors
            });
    });
}



function writeToSheet(data, accessToken) {

    
    // First, clear the sheet
    clearSheet(spreadsheetId, range, accessToken).then(() => {
        // After clearing, write new data
        var url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
        var params = {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "values": data })
        };
        fetch(url, params)
            .then(response => {
                // Check if the response is ok (status in the range 200-299)
                if (!response.ok) {
                    // If not, throw an error that includes the status
                    throw new Error('Network response was not ok, status: ' + response.status);
                }
                return response.json(); // Parse JSON only if response is ok
            })
            .then(data => {
                // Check for errors in the data object, as Google APIs might return error details in the body
                if (data.error) {
                    console.error("Error writing to sheet:", data.error);
                    return; // Prevent further processing
                }
                console.log("Success writing to sheet:", data);
            })
            .catch(error => {
                // This catches network errors and errors thrown from the first .then() block
                console.error('Error writing to sheet:', error);
            });
    }).catch(error => {
        console.error("Failed to clear sheet before writing:", error);
    });
}


// Adding event listeners for bookmark creation, removal, and changes
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    console.log('Bookmark Created:', bookmark.title);
    fetchAndPrintBookmarks();
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    console.log('Bookmark Removed');
    fetchAndPrintBookmarks();
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    console.log('Bookmark Changed:', changeInfo.title);
    fetchAndPrintBookmarks();
});

// Initial fetch and print of bookmarks
fetchAndPrintBookmarks();
