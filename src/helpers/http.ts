import axios from 'axios'
import { LogCategory, Logger } from './Logger';

export const applyAxiosRequestInterceptor = () => {
    axios.interceptors.request.use(
        function (successfulReq) {
            return successfulReq;
        },
        function (error) {
            return Promise.reject(error);
        }
    );
}
export const applyAxiosResponeInterceptor = () => {
    axios.interceptors.request.use(
        function (successfulReq) {
            return successfulReq;
        },
        function (error) {
            if (error.response.config.url.includes('/v2/wallets/'))
            {
                Logger.log({ message: `Wallet API error detected. Extracted data is: ${JSON.stringify({url: error.response.config.url, data: error.response.data})}`, event: 'walletApi.interceptedError', category: LogCategory.INFO });
            }
            return Promise.reject(error);
        }
    );
}