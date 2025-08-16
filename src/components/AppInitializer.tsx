import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { initializeDefaultTables } from '../redux/slices/tablesSlice';

const AppInitializer: React.FC = () => {
  const dispatch = useDispatch();
  const tableIds = useSelector((state: RootState) => state.tables.tableIds);

  useEffect(() => {
    // Initialize default tables if none exist
    if (tableIds.length === 0) {
      dispatch(initializeDefaultTables());
    }
  }, [dispatch, tableIds.length]);

  return null; // This component doesn't render anything
};

export default AppInitializer;

