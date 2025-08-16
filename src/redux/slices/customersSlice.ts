import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Customer } from "../../utils/types";

type CustomersState = {
customersById: Record<string, Customer>;
};

const initialState: CustomersState = {
customersById: {},
};

const customersSlice = createSlice({
name: "customers",
initialState,
reducers: {
addOrUpdateCustomer: (state, action: PayloadAction<Customer>) => {
state.customersById[action.payload.id] = action.payload;
},
},
});

export const { addOrUpdateCustomer } = customersSlice.actions;
export default customersSlice.reducer;
