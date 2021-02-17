import BottomSheet from '@gorhom/bottom-sheet';
import {
  createNavigatorFactory,
  StackActions,
  StackRouter,
  useNavigationBuilder,
} from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

function backgroundComponentFactory({ backgroundColor, targetOpacity }) {
  return function BackgroundComponent({ animatedIndex, animatedPosition }) {
    const style = useAnimatedStyle(
      () => ({
        opacity: animatedIndex.value * targetOpacity,
        transform: [{ translateY: -animatedPosition.value }],
      }),
      [targetOpacity]
    );
    return (
      <Animated.View
        style={[{ backgroundColor }, StyleSheet.absoluteFillObject, style]}
      />
    );
  };
}

function Route({ descriptor: { options, render }, onDismiss, removing }) {
  const ref = useRef();
  useEffect(() => {
    removing && ref.current.close();
  }, [removing]);

  const onAnimate = useCallback((prev, curr) => {
    if (prev === 1 && curr === 0) {
      onDismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    backgroundColor = 'black',
    targetOpacity = 1,
    height = '100%',
    snapPoints = ['100%'],
  } = options || {};

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enhancedSpanPoints = useMemo(() => [0, ...snapPoints], [...snapPoints]);
  const BackgroundComponent = useMemo(
    () => backgroundComponentFactory({ backgroundColor, targetOpacity }),
    [targetOpacity, backgroundColor]
  );

  return (
    <BottomSheet
      animateOnMount
      animationDuration={250}
      backgroundComponent={BackgroundComponent}
      containerHeight={Dimensions.get('screen').height}
      handleComponent={() => null}
      index={1}
      onAnimate={onAnimate}
      onDismiss={onDismiss}
      ref={ref}
      snapPoints={enhancedSpanPoints}
    >
      <TouchableWithoutFeedback onPress={() => ref.current.close()}>
        <View
          style={{
            height: '100%',
            position: 'absolute',
            width: '100%',
          }}
        />
      </TouchableWithoutFeedback>
      <View
        style={{
          bottom: 0,
          height,
          position: 'absolute',
          width: '100%',
        }}
      >
        {render()}
      </View>
    </BottomSheet>
  );
}

function StackView({ descriptors, state, navigation }) {
  const descriptorsCache = useRef({});
  const [firstKey, ...restKeys] = state.routes.map(route => route.key);
  const previousKeys = useRef([]);
  const [keys, setKeys] = React.useState([]);
  const newKeys = restKeys.filter(
    key => previousKeys.current.indexOf(key) === -1
  );
  const removingKeys = useRef({});

  if (newKeys.length) {
    newKeys.forEach(key => (descriptorsCache.current[key] = descriptors[key]));
    setKeys(ks => ks.concat(newKeys));
  }
  const newRemovingKeys = previousKeys.current.filter(
    key => restKeys.indexOf(key) === -1
  );
  for (let removingKey of newRemovingKeys) {
    removingKeys.current[removingKey] = true;
  }
  previousKeys.current = restKeys;

  return (
    <>
      {descriptors[firstKey].render()}
      {keys.map(
        key =>
          descriptorsCache.current[key] && (
            <Route
              descriptor={descriptorsCache.current[key]}
              key={key}
              onDismiss={() => {
                !removingKeys.current[key] &&
                  navigation?.dispatch?.({
                    ...StackActions.pop(),
                    source: key,
                    target: state.key,
                  });
                descriptorsCache.current[key] = undefined;
                removingKeys.current[key] = undefined;
                setKeys(routesKeys =>
                  routesKeys.filter(routeKey => routeKey !== key)
                );
              }}
              removing={removingKeys.current[key]}
            />
          )
      )}
    </>
  );
}

function StackNavigator({
  initialRouteName,
  children,
  screenOptions,
  ...rest
}) {
  const defaultOptions = {
    animationEnabled:
      Platform.OS !== 'web' &&
      Platform.OS !== 'windows' &&
      Platform.OS !== 'macos',
    gestureEnabled: true,
  };

  const { state, descriptors, navigation } = useNavigationBuilder(StackRouter, {
    children,
    initialRouteName,
    screenOptions:
      typeof screenOptions === 'function'
        ? (...args) => ({
            ...defaultOptions,
            ...screenOptions(...args),
          })
        : {
            ...defaultOptions,
            ...screenOptions,
          },
  });

  React.useEffect(
    () =>
      navigation.addListener?.('tabPress', e => {
        const isFocused = navigation.isFocused();

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          if (state.index > 0 && isFocused && !e.defaultPrevented) {
            // When user taps on already focused tab and we're inside the tab,
            // reset the stack to replicate native behaviour
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: state.key,
            });
          }
        });
      }),
    [navigation, state.index, state.key]
  );

  return (
    <StackView
      {...rest}
      descriptors={descriptors}
      navigation={navigation}
      state={state}
    />
  );
}

export default createNavigatorFactory(StackNavigator);