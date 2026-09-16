export type LoginResult = {
	token?: string;
	redirect?: string;
	error?: string;
	twoFactorRequired?: boolean;
	pendingToken?: string;
};
