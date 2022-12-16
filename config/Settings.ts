import { ISetting, SettingType} from '@rocket.chat/apps-engine/definition/settings';

export enum AppSetting {
    JiraAltToken = 'jiraalt_token',
    JiraAltUrl = 'jiraalt_url',

}

export const settings: Array<ISetting> = [
    {
        id: AppSetting.JiraAltToken,
        public: true,
        type: SettingType.STRING,
        value: "",
        packageValue: "",
        hidden: false,
        i18nLabel: 'JiraAlt_TokenLabel',
        required: true,
    },
    {
        id: AppSetting.JiraAltUrl,
        public: true,
        type: SettingType.STRING,
        value: "",
        packageValue: "",
        hidden: false,
        i18nLabel: 'JiraAlt_UrlLabel',
        required: true,
    }
]