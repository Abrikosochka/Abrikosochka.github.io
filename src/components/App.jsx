  const { setCurrentUser } = useUserStore();

  useEffect(() => {
    const user = getCurrentUser();
    console.log('Initial user data:', user);
    if (user) {
      setCurrentUser(user);
    }
  }, []); 