export const isRequireSupported = () => {
    try {
        require('fs');
        return true;
    } catch (error) {
        return false;
    }
};
