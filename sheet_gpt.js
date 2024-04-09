

// https://platform.openai.com/docs/api-reference/chat/create
class GPT{
	static get BASE_URL(){
		return 'https://api.openai.com/v1/';
	}
	static get MODELS(){
		return {
			// https://platform.openai.com/docs/models/
			// https://openai.com/pricing/
			gpt_4_preview : { // 128K context window
				officialName               : 'gpt-4-1106-preview',
				price_per_1k_input_tokens  : 0.01,
				price_per_1k_output_tokens : 0.03,
				isDefault                  : true,
			},
			gpt_3 : { // 16K context window, optimized for dialog
				officialName               : 'gpt-3.5-turbo-1106',
				price_per_1k_input_tokens  : 0.001,
				price_per_1k_output_tokens : 0.002,
			},
			// only 1106 models support JSON mode. Following models can't be used.
			/*
			gpt_4 : {
				officialName               : 'gpt-4',
				price_per_1k_input_tokens  : 0.03,
				price_per_1k_output_tokens : 0.06,
			},
			gpt_4_32k : {
				officialName               : 'gpt-4-32k',
				price_per_1k_input_tokens  : 0.06,
				price_per_1k_output_tokens : 0.12,
			},
			*/
		};
	}
	static get DEFAULT_MODEL_NAME(){
		return 'gpt_4_preview';
	}
	static get ENDPOINTS(){
		return {
			COMPLETITIONS : 'chat/completions',
			MODELS        : 'chat/models',
		};
	}
	static get TEMPERATURE(){
		return 0.7;
	}
	static get RESPONSE_FORMATS(){
		return {
			// https://platform.openai.com/docs/api-reference/chat/create
			TEXT		   : undefined, // docs don't not mention this
			JSON		   : { type : 'json_object' },
		};
	}
	static newInstance({
			systemMessage  = '',
			modelName      = GPT.DEFAULT_MODEL_NAME,
			temperature    = GPT.TEMPERATURE,
			responseFormat,
		 }){
		return new GPT({
			messages : [ systemMessage ].filter( message => message.length > 0 ).map( message => ({
				role    : 'system',
				content : message,
			})),
			modelName,
			temperature,
			responseFormat,
		});
	}
	constructor({
			messages       = [],
			modelName      = GPT.DEFAULT_MODEL_NAME,
			temperature    = GPT.TEMPERATURE,
			responseFormat,
		}={
			messages       : [],
			modelName      : GPT.DEFAULT_MODEL_NAME,
			temperature    : GPT.TEMPERATURE,
			responseFormat,
		}){
		this.modelName      = modelName;
		this.messages       = messages;
		this.temperature    = temperature;
		this.responseFormat = responseFormat;
	}
	usageStats( usage ){
		const usage1 = JSON.parse( PropertiesService.getScriptProperties().getProperty( 'OPEN_AI_API_USAGE' ) ) ?? {};
		usage1.prompt_tokens     = ( usage1.prompt_tokens     ?? 0 ) + usage.prompt_tokens;
		usage1.completion_tokens = ( usage1.completion_tokens ?? 0 ) + usage.completion_tokens;
		usage1.total_tokens      = ( usage1.total_tokens      ?? 0 ) + usage.total_tokens;
		const price = usage.prompt_tokens     * GPT.MODELS[ this.modelName ].price_per_1k_input_tokens  / 1000
		            + usage.completion_tokens * GPT.MODELS[ this.modelName ].price_per_1k_output_tokens / 1000
		;
		console.log( price.toFixed( 2 ) + ' USD' );
		PropertiesService.getScriptProperties().setProperty( 'OPEN_AI_API_USAGE', JSON.stringify( usage1 ) );
		return price;
	}
	ask( input ){
		const response = GPT.request({
			method : 'post',
			payload : {
				model       : GPT.MODELS[ this.modelName ].officialName,
				messages    : this.messages.concat([
					{
						role    : 'user',
						content : input,
					},
				]),
				response_format : this.responseFormat, // json, text, srt, verbose_json, or vtt
				temperature 	: this.temperature, // Higher values like 0.8 will make the output more random
			},
			endpoint : GPT.ENDPOINTS.COMPLETITIONS,
		});
		const price = this.usageStats( response.usage );
		const choice = response.choices.at( 0 );
		if( choice.finish_reason !== 'stop' ){
			throw new Error( 'finish_reason: ' + choice.finish_reason );
		}
		// coice.message.role is probably assistant
		//console.log( choice.message.content );
		return {
			response : choice.message.content,
			price    : price,
		};
	}
	static models(){
		return GPT.request({
			endpoint : GPT.ENDPOINTS.MODELS,
			method   : 'get',
		}).choices.at( 0 );
	}
	static request({
			method  = 'get',
			payload  = {},
			endpoint = GPT.ENDPOINTS.COMPLETITIONS,
		}){
		const startTime = Date.now();
		const response = UrlFetchApp.fetch(
			GPT.BASE_URL + endpoint,
			{
				method,
				headers : {
					Authorization : 'Bearer ' + PropertiesService.getScriptProperties().getProperty( 'OPENAI_KEY' ),
				},
				contentType : 'application/json',
				...( method === 'post' ? { payload : JSON.stringify( payload ) } : {} ),
				muteHttpExceptions : true,
			}
		);
		const duration = Math.round( ( Date.now() - startTime ) / 10 ) / 100;
		console.log( 'duration: ' + duration + 's' );
		const parsed = JSON.parse( response.getContentText() ); // SyntaxError: Unexpected token ... is not valid JSON
		if( parsed.error ){
			throw new Error( JSON.stringify( parsed.error, null, 2 ) );
	//"code": 503,
	//"message": "Service Unavailable.",
	//"param": null,
	//"type": "cf_service_unavailable"
		}
		//console.log( parsed );
		//console.log( 'response: ' + JSON.stringify( parsed, null, 2 ) );
		return parsed;
	}
}
const INSTRUCTIONS_JSON = `
	As input you will get a list of objects. Some attributes of these objects are missing. Pls fill in the missing attributes.
	Always answer in JSON. Output format should be like this:
	{
		items : [
			{
				// attributes of the first item
			},
			{
				// attributes of the second item
			}
		]
	}
	Instructions for each attribute as follows:
	UNIQUE_ID: This attribute is used to match the input and output items. Pls don't change it.
`;

function testIt(){
	const sheetName = 'test';
	const result = chatGptServerside({
		sheetName,
	 });
	 console.log( result );
}









function chatGptServerside({
		numRows            = 20, // choose a large number to reduce the number of calls to the model to stay below the limit of 200 calls per day
		sheetName,
		modelName          = GPT.DEFAULT_MODEL_NAME,
		temperature        = 0.1,
		price              = 0,
		allowAlterInputs   = true,
		commonInstructions = '',
	 }){
	const sheet = SheetsTable.sheet({ sheetName });
	const model = GPT.newInstance({
		responseFormat : GPT.RESPONSE_FORMATS.JSON,
		systemMessage  : INSTRUCTIONS_JSON + JSON.stringify( sheet.getHeaderNotes(), null, 2 ) + '\n' + commonInstructions + '\n',
		temperature,
		modelName,
	});
	const inputItems = sheet
		.getItems()
		.map( ( item, index ) => ({ item, index }))
		// first column is a fixed input column ( input_ == 0 ), never use it to determine if the row is complete
		.filter( ({ item }) => Object.values( item ).some( ( x, index_ ) => index_ !== 0 && x === '' ) ) // only incomplete items 
		.map( arr => ( console.log( arr ), arr ) )
		.slice( 0, numRows )
	;
	const indexes = inputItems.map( ({ index }) => index );
	console.log( 'indexes: ' + JSON.stringify( indexes ) );
	if( inputItems.length === 0 ){
		return JSON.stringify({
			status : 'Done',
			price,
		});
	}
	function askTheModel({ inputItems, model, allowAlterInputs }){
		if( inputItems.some( item => item.UNIQUE_ID ) ){
			throw new Error( 'UNIQUE_ID is a reserved attribute name. Pls don\'t use it' );
		}
		inputItems = inputItems.map( item => ({ ...item, UNIQUE_ID : Utilities.getUuid() }) );
		const input     = inputItems
			.map( item => JSON.stringify( item ) )
			.join( '\n' )
		;
		let items       = [];
		let price       = 0;
		let countTries  = 0;
		const MAX_TRIES = 1;
		do{
			try{
				countTries++;
				if( countTries > 1 ){
					console.log( 'retry: ' + countTries );
				}
				const { response, price : price_ } = model.ask( input );
				price += price_;
				items = JSON.parse( response ).items;
				// check if the model returned the same number of items as the input
				if( items.length !== inputItems.length ){
					throw new Error( 'items.length !== inputItems.length' + items.length + ' !== ' + inputItems.length );
				}
				const adjustedItems = inputItems.map( inputItem => {
					const item = items.find( item => item.UNIQUE_ID === inputItem.UNIQUE_ID );
					if( !item ){
						throw new Error( 'Input-item not found in output of the model. ', JSON.stringify( inputItem ) );
					}
					if( !allowAlterInputs ){
						Object
							.entries( inputItem )
							.filter( ([ , value ]) => value !== '' ) // only pre-filled attributes
							.forEach( ([ key, value ]) => {
								if( item[ key ] !== value ){
									console.log( 'restore key: ' + key + ' from value: ' + item[ key ] + ' to value: ' + value );
									item[ key ] = value; // restore the pre-filled attributes
								}
							})
						;
					}
					// Don't allow empty attributes,
					// because empty attributes are used to indicate that the row was not yet processed by the model.
					// If the model returns an empty attribute, replace it with [EMPTY]
					let outputOnce = false;
					Object
						.keys( inputItem )
						.forEach( key => {
							if( !( key in item ) || item[ key ] === '' || item[ key ] === null || item[ key ] === undefined ){
								console.log( 'empty value for key: ' + key + ' value: ' + item[ key ] );
								if( !outputOnce ){
									outputOnce = true;
									console.log( item );
								}
								item[ key ] = '[EMPTY]';
							}
						})
					;
					delete item.UNIQUE_ID;
					return item;
				});
				return {
					items : adjustedItems,
					price,
				};
			}catch( error ){
				if( countTries >= MAX_TRIES ){
					throw error;
				}
			}
		}while( true );
	}
	const { items, price : price_ } = askTheModel({
		inputItems : inputItems.map( ({ item }) => item ),
		model,
		allowAlterInputs,
	});
	// It is ensured by our code that the items are returned in the same order as they wre sent to the model.

	function writeItems({ items, indexes, sheet }){
		// if the indexes of rows are consecutive and have no gaps treat them as a single range
		function isConsecutive( arr ){
			// Check if each element is one less than the next
			for( let i = 0; i < arr.length - 1; i++ ){
				if( arr[ i ] + 1 !== arr[ i + 1 ] ){
					return false;
				}
			}
			return true;
		}
		const firstHeader = sheet.getHeaders()[ 0 ];
		const items2 = items.map( item => Object.fromEntries( Object.entries( item ).filter( ([ key ]) => key !== firstHeader ) ) );
		if( isConsecutive( indexes ) ){
			sheet.write({ items : items2, rowIndex : indexes[ 0 ] });
		}else{
			items2.forEach( ( item, i ) => {
				sheet.write({ items : [ item ], rowIndex : indexes[ i ] });
			});
		}
	}
	writeItems({ items, indexes, sheet });
	return JSON.stringify({
		status    : inputItems.length < numRows ? 'Done' : 'Next',
		sheetName : sheet.getSheetName(), // don't use sheetName here, because it might be undefined
		price     : price + price_,
	});
}

function showSidebarChatGPT(){
	function handleButtonClick(){ // client side
		const button = document.getElementById( 'main_button' );
		if( [ 'Stop', 'Stopping...' ].includes( button.innerText ) ){
			button.innerText = 'Stopping...';
			return;
		}
		button.innerText = 'Stop';
		function printStatus({ text, price, messagesToKeep = 3 }){
			if( price ){
				document.getElementById( 'price' ).innerText = price.toFixed( 2 );
			}
			const statusDiv = document.getElementById( 'status' );
			const statusSoFar = statusDiv.innerHTML
				.split( '<br>' )
				.slice( -messagesToKeep )   // keep only the last messagesToKeep messages if messagesToKeep > 0
				.slice( 0, messagesToKeep ) // this is needed because slice( -messagesToKeep ) returns the whole array if messagesToKeep is 0
			;
			// current time in format HH:MM:SS
			const time = new Date().toTimeString().split( ' ' )[ 0 ];
			statusDiv.innerHTML = [].concat( statusSoFar, time + ': ' + text ).join( '<br>' );
		}
		function serverSideCall({ sheetName, price }={}){
			if( !sheetName ){
				printStatus({ text : 'Submitting...' } );
			}
			const modelName          =  document.getElementById( 'gpt_model_name'      ).value;
			const temperature        = +document.getElementById( 'temperature'         ).value;
			const allowAlterInputs   =  document.getElementById( 'allow_alter_inputs'  ).checked;
			const commonInstructions =  document.getElementById( 'common_instructions' ).value;
			const numRows            = +document.getElementById( 'count_rows'          ).value;
			google.script.run
				.withSuccessHandler( json => {
					const { status, sheetName, price } = JSON.parse( json );
					if( status === 'Done' ){
						printStatus({ text : status, price });
						button.innerText = 'Start';
					}else{
						if( button.innerText === 'Stopping...' ){
							printStatus({ text : 'Stopped', price });
							button.innerText = 'Start';
							return;
						}
						printStatus({ text : 'Submitting rows...', price });
						serverSideCall({ sheetName, price });
					}
				})
				.withFailureHandler( error => {
					console.error( error );
					printStatus({ text : 'An error occurred in handleButtonClick: ' + error.message });
					button.innerText = 'Start';
					alert( 'An error occurred: ' + error.message );
				})
				.handleClientCall({
					functionName : 'chatGptServerside',
					parameters   : {
						sheetName,
						modelName,
						temperature,
						price,
						allowAlterInputs,
						numRows,
						commonInstructions,
					},
				})
			;
		}
		serverSideCall();
	}
	const html = `<!DOCTYPE html>
	<html>
		<head>
			<base target="_top">
			<style>
				#status,button {
					margin-top: 10px;
				}
				select, .text_field, button, input {
					box-sizing : border-box;
					width      : 260px;
				}
				select,.text_field { display: block; margin-bottom: 10px; }
				label { display: block; font-weight: bold; }
			</style>
			<script>
				${handleButtonClick}
			</script>
		</head>
		<body>
		<label>Model<br>
			<select id="gpt_model_name">
				${Object.entries( GPT.MODELS ).map( ([ key, { isDefault, price_per_1k_input_tokens, price_per_1k_output_tokens }]) =>
					`<option value="${key}" ${ isDefault ? 'selected' : '' }>${key} (${
						( ( price_per_1k_input_tokens + price_per_1k_output_tokens ) / 2 ).toFixed( 3 )
					} USD)</option>`
				).join( '\n' )}
			</select>
		</label>
		<label>Temperature<br>
			<!-- https://platform.openai.com/docs/guides/text-generation/faq 
			The temperature can range is from 0 to 2.
			But 2 lets the model talk until it runs into length limits. So let's use 1 as the max value.
			-->
			<input id="temperature" type="range" min="0" max="1" step="0.1" value="0.1">
		</label>
		<label> Allow the model to alter the pre-filled values of the input rows? <br>
			<input id="allow_alter_inputs" type="checkbox" checked>
		</label>
		<label># Rows per Request<br>
			<input id="count_rows" type="range" min="1" max="20" step="1" value="5" list="markers">
			<datalist id="markers">
				<option value="1"></option>
				<option value="5"></option>
				<option value="10"></option>
				<option value="15"></option>
			</datalist>
		</label>
		<textarea id="common_instructions" class="text_field" rows="15" cols="50" placeholder="Common instructions for all rows"></textarea>
		<button id="main_button" onclick="handleButtonClick()">Start</button>
		<br>
		<br>
		Price: <span id="price">0.00</span> USD
		<br>
		<div id="status"></div>
	  </body>
	  <script>
	  </script>
	</html>`
	;
	showSidebar({ title : 'Chat GPT', html });
}



function initKeys(){
	Object.entries({
		OPENAI_KEY : 'insert_here',
	})
	.filter( ([ key, value ]) => value !== 'insert_here' )
	.forEach( ([ key, value ]) =>
		PropertiesService.getScriptProperties().setProperty( key, value )
	);
	Object.entries( PropertiesService.getScriptProperties().getProperties() )
		.forEach( ([ key, value ]) => console.log( key + ' ' + value ) )
	;
}


/**
 * 

*/
const WIDTH = 300;

function createOnOpenTrigger(){
	// This function needs to be called every time the project ID of the apps script is changed.
	// The old trigger belongs to the old project and is not deleted automatically.
	if(
		ScriptApp
			.getProjectTriggers()
			.map( trigger => trigger.getHandlerFunction() )
			.includes( 'onOpenFunction' )
	 ){
		console.log( 'The onOpen trigger already exists.' );
	}else{
		ScriptApp
			.newTrigger( 'onOpenFunction' )
			.forSpreadsheet( SpreadsheetApp.getActive() )
			.onOpen()
			.create()
		;
		console.log( 'The onOpen trigger has been created.' );
	}
}

function onOpenFunction(){
	const menu = SpreadsheetApp
		.getUi()
		.createMenu( 'External_Tools' )
	;
	// showSidbar[ToolName]
	const sidebars = Object
		.entries( this )
		.filter( ([    , value ]) => typeof value === 'function' )
		.filter( ([ key        ]) => key.startsWith( 'showSidebar' ) && key !== 'showSidebar' )
	;
	sidebars.forEach( ([ name ]) => menu.addItem( name.replace( 'showSidebar', '' ), name ) );
	if( sidebars.length === 1 ){
		sidebars[ 0 ][ 1 ](); // if there is just one sidebar, show it immediately
	}
	menu.addToUi();
}

function showSidebar({ title, html }){
	SpreadsheetApp.getUi().showSidebar(
		HtmlService
			.createHtmlOutput( html )
			.setTitle( title )
			.setWidth( WIDTH )
	);
}

function handleClientCall({ functionName, parameters }){
	return this[ functionName ]( parameters );
}

// ------------------------------------------------------------------

function testSheet(){
	const table = SheetsTable.sheet({ sheetName : 'test', headers : [ 'a', 'b' ] });
	table
		.writeHeaders()
		.write({ items : [ { a : 1, b : 2 } ], rowIndex : 1 })
	;
}
class SheetsAppRaw{
	constructor({ documentId, documentUrl, sheetName, sheetId }={}){
		this.document =
			documentId ?
			  SpreadsheetApp.openById( documentId )
			: documentUrl ?
			  SpreadsheetApp.openByUrl( documentUrl )
			: SpreadsheetApp.getActive()
		;
		const index = 0;
		const options = {};
		this.sheet =
			sheetId ?
				this.document
					.getSheets()
					.find( sheet => sheet.getSheetId() === sheetId )
			: sheetName ?
			  this.document.getSheetByName( sheetName ) ?? this.document.insertSheet( sheetName, index, options )
			: this.document.getActiveSheet()
		;
	}
	static sheet( arg ){
		if( typeof arg === 'object' ){
			return new SheetsAppRaw( arg );
		}
		if( typeof arg === 'string' ){
			return new SheetsAppRaw({ sheetName : arg });
		}
		if( typeof arg === 'number' ){
			return new SheetsAppRaw({ sheetId : arg });
		}
		if( typeof arg === 'undefined' ){
			return new SheetsAppRaw();
		}
		throw new Error( 'Invalid argument. Expected object, string or number. Received ' + typeof arg );
	}
	trim(){
		const rowsToRetain = Math.max(
			this.sheet.getLastRow(), // keep everything until the last non-empty row
			this.sheet.getFrozenRows() + 1 // it is not possible to delete all non-frozen rows
		);
		const rowsToDelete = this.sheet.getMaxRows() - rowsToRetain;
		if( rowsToDelete > 0 ){
			this.sheet.deleteRows(
				rowsToRetain + 1, // row position. start with the row after the last row to retain
				rowsToDelete,
			);
		}
		const columnsToRetain = Math.max(
			this.sheet.getLastColumn(), // keep everything until the last non-empty column
			this.sheet.getFrozenColumns() + 1 // it is not possible to delete all non-frozen columns
		);
		const columnsToDelete = this.sheet.getMaxColumns() - columnsToRetain;
		if( columnsToDelete > 0 ){
			this.sheet.deleteColumns(
				columnsToRetain + 1, // column position. start with the column after the last column to retain
				columnsToDelete,
			);
		}
		return this;
	}
	getFilter(){
		return this.sheet.getFilter();
	}
	removeFilter(){
		this.getFilter()?.remove();
		return this;
	}
	clear(){
		this.sheet.clear();
		return this;
	}
	setFrozenRows( frozenRows ){
		this.sheet.setFrozenRows( frozenRows );
		return this;
	}
	write({ rows, startRow = 1, startColumn = 1 }){
		if( !Array.isArray( rows ) ){
			throw new Error( 'rows must be an array' );
		}
		if( !rows.every( row => row.length === rows[ 0 ].length ) ){
			throw new Error( 'All rows must have the same length' );
		}
		this.sheet
			.getRange(
				startRow,
				startColumn,
				rows.length,
				rows[ 0 ].length
			)
			.setValues( rows )
		;
		return this;
	}
	append( rows ){
		return this.write({
			rows,
			startRow : this.sheet.getLastRow() + 1,
		});
	}
	getSheetName(){
		return this.sheet.getName();
	}
	getSheetId(){
		return this.sheet.getSheetId();
	}
}

class SheetsTable extends SheetsAppRaw{
	constructor({ documentId, documentUrl, sheetName, sheetId, headers, headerRow = 1, startRow = 2, startColumn = 1 }){
		super({ documentId, documentUrl, sheetName, sheetId });
		if( !headers && this.sheet.getLastColumn() === 0 ){
			throw new Error( 'headers must be provided for an empty sheet' );
		}
		this.startRow    = startRow;
		this.startColumn = startColumn;
		this.headerRow   = headerRow;
		this.headers     = headers ?? this.sheet.getRange( 1, 1, 1, this.sheet.getLastColumn() ).getValues()[ 0 ];
	}
	static sheet({ documentId, documentUrl, sheetName, sheetId, headers, headerRow = 1, startRow = 2, startColumn = 1 }){
		return new SheetsTable({ documentId, documentUrl, sheetName, sheetId, headers, headerRow, startRow, startColumn });
	}
	writeHeaders(){
		super.write({ rows : [ this.headers ], startRow : this.headerRow });
		return this;
	}
	/**
	 * Writes ( or replaces ) the items to the sheet.
	 * Only the properties that are included in the headers are written. Of these, all items must have the same properties.
	 * Items may have additional properties that are not included in the headers. These are ignored.
	 */
	write({ items, rowIndex = 0 }){
		const itemHeaders = items
			.flatMap( Object.keys )
			.filter( onlyUnique() )
			.filter( isIncludedIn( this.headers ) )
		;
		if( !items.every( item => itemHeaders.every( header => header in item ) ) ){
			throw new Error( 'All items must have the same subset of properties for this table' );
		}
		this.headers
			.map    ( ( header, colIndex ) => ({ header, colIndex }) )
			.filter ( item => itemHeaders.includes( item.header ) )
			.forEach( ( { header, colIndex } ) => { // write each column individually
				super.write({
					rows        : items.map( item => [ item[ header ] ] ),
					startRow    : this.startRow    + rowIndex,
					startColumn : this.startColumn + colIndex,
				});
			})
		;
		return this;
	}
	getValues(){
		return this.sheet.getRange(
			this.startRow,
			this.startColumn,
			this.sheet.getLastRow() - this.startRow + 1, // better ideas how to get the number of rows?
			this.headers.length
		).getValues();
	}
	getItems(){
		return this
			.getValues()
			.map( row =>
				Object.fromEntries(
					this.headers.map( ( header, index ) => [ header, row[ index ] ] )
				)
			)
		;
	}
	getHeaderNotes(){
		const notes = this.sheet
			.getRange(
				this.headerRow,
				1,
				1,
				this.headers.length
			)
			.getNotes()
			[ 0 ]
		;
		return Object.fromEntries( notes.map( ( note, index ) => [ this.headers[ index ], note ] ) );
	}
	getHeaders(){
		return this.headers;
	}
}

function onlyUnique( ...mapperList ){
	const memory = new Set();
	const finalMapper = function( item, index, array ){
		var res = item;
		mapperList.forEach( function( mapper ){
			res = apply( res, mapper, index, array );
		});
		return res;
	};
	if( mapperList.length === 0 ){ // this is optional and just here to reduce overhead a little
		return function( value ){
			const found = memory.has( value );
			memory.add( value );
			return !found;
		};
	}
	return function( value, index, array ){
		const mappedValue = apply( value, finalMapper, index, array );
		const found = memory.has( mappedValue );
		memory.add( mappedValue );
		return !found;
	};
}

function isIncludedIn( arr ){
	if( ! Array.isArray( arr ) ){
		arr = [].slice.call( arguments );
	}
	return item => arr.includes( item );
}

function isNotIncludedIn( arr ){
	const func = isIncludedIn.apply( null, arguments );
	return item => !func( item );
}