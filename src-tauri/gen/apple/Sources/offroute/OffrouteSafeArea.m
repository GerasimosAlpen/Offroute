#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface ORSafeAreaFix : NSObject
@end

static void walkAndFix(UIView *view) {
  if ([view isKindOfClass:[WKWebView class]]) {
    WKWebView *w = (WKWebView *)view;
    if (@available(iOS 11.0, *)) {
      w.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    }
    if (!UIEdgeInsetsEqualToEdgeInsets(w.scrollView.contentInset, UIEdgeInsetsZero)) {
      w.scrollView.contentInset = UIEdgeInsetsZero;
    }
    w.backgroundColor = [UIColor colorWithRed:10/255.0 green:10/255.0 blue:10/255.0 alpha:1.0];
    [w setNeedsLayout];
  }
  for (UIView *sub in view.subviews) {
    walkAndFix(sub);
  }
}

static void applyFix(void) {
  NSArray *windows = nil;
  if (@available(iOS 15.0, *)) {
    NSMutableArray *all = [NSMutableArray array];
    for (UIWindowScene *scene in [UIApplication sharedApplication].connectedScenes) {
      for (UIWindow *w in scene.windows) [all addObject:w];
    }
    windows = all;
  } else {
    windows = [[UIApplication sharedApplication] windows];
  }
  for (UIWindow *window in windows) {
    UIViewController *vc = window.rootViewController;
    if (!vc) continue;
    vc.edgesForExtendedLayout = UIRectEdgeAll;
    vc.extendedLayoutIncludesOpaqueBars = YES;
    if (vc.isViewLoaded) walkAndFix(vc.view);
  }
}

@implementation ORSafeAreaFix
+ (void)load {
  NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
  [nc addObserver:self selector:@selector(onLaunch:)
             name:UIApplicationDidFinishLaunchingNotification object:nil];
  [nc addObserver:self selector:@selector(onWindowVisible:)
             name:UIWindowDidBecomeVisibleNotification object:nil];
  [nc addObserver:self selector:@selector(onWindowKey:)
             name:UIWindowDidBecomeKeyNotification object:nil];
  [nc addObserver:self selector:@selector(onRotate:)
             name:UIDeviceOrientationDidChangeNotification object:nil];
}

+ (void)onLaunch:(NSNotification *)n           { applyFix(); dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), applyFix); }
+ (void)onWindowVisible:(NSNotification *)n    { applyFix(); }
+ (void)onWindowKey:(NSNotification *)n        { applyFix(); }
+ (void)onRotate:(NSNotification *)n           { applyFix(); }
@end
