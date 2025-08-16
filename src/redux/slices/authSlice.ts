import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { StaffRole } from "../../utils/types";

type AuthState = {
isLoggedIn: boolean;
role: StaffRole;
userName?: string;
};

const initialState: AuthState = {
isLoggedIn: false,
role: "Owner",
};

const authSlice = createSlice({
name: "auth",
initialState,
reducers: {
login: (state, action: PayloadAction<{ userName: string; role?: StaffRole }>) => {
state.isLoggedIn = true;
state.userName = action.payload.userName;
state.role = action.payload.role || state.role;
},
logout: (state) => {
state.isLoggedIn = false;
state.userName = undefined;
},
},
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
