import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType } from "react-native-google-mobile-ads";
import { COLORS } from "../constants/colors";
import { AD_UNIT_IDS, HISTORY_ITEM_HEIGHT } from "../constants/app";
import { captureError } from "../utils/monitoring";

export default function NativeAdCard() {
  const [nativeAd, setNativeAd] = useState(null);

  useEffect(() => {
    let ad = null;

    NativeAd.createForAdRequest(AD_UNIT_IDS.NATIVE)
      .then((loaded) => {
        ad = loaded;
        setNativeAd(loaded);
      })
      .catch((error) => {
        captureError(error, { context: "NativeAdCard", action: "load" });
      });

    return () => {
      ad?.destroy();
    };
  }, []);

  if (!nativeAd) {
    return <View style={styles.placeholder} />;
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.container}>
      <View style={styles.adLabelContainer}>
        <Text style={styles.adLabel}>広告</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.textGroup}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={1}>
              {nativeAd.headline}
            </Text>
          </NativeAsset>

          {nativeAd.body ? (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body} numberOfLines={2}>
                {nativeAd.body}
              </Text>
            </NativeAsset>
          ) : null}

          {nativeAd.advertiser ? (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text style={styles.advertiser} numberOfLines={1}>
                {nativeAd.advertiser}
              </Text>
            </NativeAsset>
          ) : null}
        </View>

        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <TouchableOpacity style={styles.ctaButton} activeOpacity={0.8}>
              <Text style={styles.ctaText} numberOfLines={1}>
                {nativeAd.callToAction}
              </Text>
            </TouchableOpacity>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HISTORY_ITEM_HEIGHT,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: "space-between",
  },
  placeholder: {
    height: HISTORY_ITEM_HEIGHT,
    marginBottom: 12,
  },
  adLabelContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f4f4",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adLabel: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  body: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  advertiser: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
});
