import axios, { AxiosInstance } from 'axios'
import { LogCategory, Logger } from './Logger';

export const applyAxiosRequestInterceptor = (axiosInstance?: AxiosInstance) => {
    const ax = axiosInstance || axios;
    ax.interceptors.request.use(
        function (successfulReq) {
            return successfulReq;
        },
        function (error) {
            return Promise.reject(error);
        }
    );
}
export const applyAxiosResponeInterceptor = (axiosInstance?: AxiosInstance) => {
    const ax = axiosInstance || axios;
    ax.interceptors.request.use(
        function (successfulReq) {
            return successfulReq;
        },
        function (error) {
            console.log(`I am in the interceptor! - ${JSON.stringify(error)}`);
            if (error.response.config.url.includes('/v2/wallets/'))
            {
                Logger.log({ message: `Wallet API error detected. Extracted data is: ${JSON.stringify({url: error.response.config.url, data: error.response.data})}`, event: 'walletApi.interceptedError', category: LogCategory.INFO });
            }
            return Promise.reject(error);
        }
    );
}