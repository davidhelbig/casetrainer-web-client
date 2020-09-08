export class Backend {
    constructor() {
        this.baseUrl = '';
    }

    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
    }

    static encodeDataToUrl(data) {
        let urlEncodedData = "",
            urlEncodedDataPairs = [],
            name;

        // Turn the data object into an array of URL-encoded key/value pairs.
        for( name in data ) {
            // if values are passed as an array, add the sequence of key=value for each value in the array
            if (Array.isArray(data[name])) {
                data[name].forEach(value => {
                    urlEncodedDataPairs.push( encodeURIComponent( name ) + '=' + encodeURIComponent( value ) );
                })
            } else {
                urlEncodedDataPairs.push( encodeURIComponent( name ) + '=' + encodeURIComponent( data[name] ) );
            }
        }

        // Combine the pairs into a single string and replace all %-encoded spaces to 
        // the '+' character; matches the behaviour of browser form submissions.
        urlEncodedData = urlEncodedDataPairs.join( '&' ).replace( /%20/g, '+' );
        return urlEncodedData;
    }

    async get(endpoint, data) {
        const urlQueryPart = Backend.encodeDataToUrl(data);
        const urlFull = this.baseUrl + "/" + endpoint + "?" + urlQueryPart;
        try {
            const response = await fetch(urlFull);
            return await response.json();
        } catch (error) {
            throw new Error(error);
        }
    }
}
