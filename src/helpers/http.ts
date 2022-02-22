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
    ax.interceptors.response.use(
        function (successfulReq) {
            return successfulReq;
        },
        function (error) {
            if (error.response.config.url.includes('/v2/'))
            {
                Logger.log({ message: `Wallet API error detected. Extracted data is: ${JSON.stringify({url: error.response.config.url, data: error.response.data})}`, event: 'walletApi.interceptedError', category: LogCategory.INFO });
                error.response.request.responseData = error.response.data;
            }
            return Promise.reject(error);
        }
    );
}