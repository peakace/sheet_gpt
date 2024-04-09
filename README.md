# SheetGPT Integration for Google Sheets

SheetGPT is a powerful script that allows you to automatically fill in incomplete data in your Google Sheets using OpenAI's GPT models. Follow the instructions below to set it up and use it.

## Setup Instructions

1. Create a new Google Sheet.
2. Open the Apps Script editor by selecting `Extensions > Apps Script` from your Google Sheet.
3. Copy the content of `sheet_gpt.js` into the Apps Script editor.
4. Run the script by selecting the `createOnOpenTrigger` function (selected by default) and execute it.
5. Refresh your Google Sheet to see a new side panel.
6. Enter your OpenAI API key in the side panel and click "Save Key" (wait up to 5 seconds for it to save).

## Usage

- To start, write some headers in the first row and some incomplete data in the rows below.
- Click the "Start Autofill" button in the side panel.
- The script sends the data to an OpenAI model to complete the missing cells.

### Optional Settings

- **Model Selection**: Choose between GPT-4 or GPT-3.
- **Temperature**: Adjust the creativity of the responses.
- **Batch Size**: Controls how many rows are processed at once. Lower values help avoid token limits, while higher values might improve quality by giving more context to the model.
- **Instructions**: A text area is available for common instructions for all rows, sent as a system message in each call to the LLM model.
- **Status Output**: Provides information on the script's progress and adjusts price information after each call.

## License

This project is licensed under the MIT License. See the LICENSE file in the repository for more details.
