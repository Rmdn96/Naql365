import type { Locale } from './config';

const en = {
  journey: 'Your transport, step by step',
  quoteIntro: 'Review the route, final price and validity before responding.',
  finalPrice: 'Your final quote',
  quoteDecision: 'Ready to continue?',
  quoteDecisionHelp:
    'Accept to continue to payment, or reject this quote. Your response applies to this version.',
  paymentIntro: 'Choose how to pay and follow the status of your payment here.',
  paymentReview:
    'Proof received. Our Finance team will verify the transfer. You do not need to upload it again while it is under review.',
  paymentRejected:
    'Review the reason below, then upload a new proof. Payment is not yet confirmed.',
  paymentConfirmed: 'Payment confirmed. Follow your order for transport and delivery updates.',
  transferUnavailable: 'No transfer option is currently available for this order.',
  trackingIntro:
    'Follow confirmed delivery updates here. This page shows the latest recorded progress.',
  secureHelp: 'Keep your secure link private. A request reference alone cannot open your journey.',
  requestIntro: 'Tell us what needs moving. Our team reviews your details and sends a final quote.',
  reviewTitle: 'Pricing under review',
  reviewHelp:
    'Our team reviews your route and transport details before sending a final quote. No payment is requested at this step.',
  profileHelp: 'Add your name and contact number so we can help with your transport request.',
  loginHelp: 'Welcome back. Sign in to continue your requests and deliveries.',
  registerHelp:
    'Create an account to keep your requests together. You can also request transport without registering.',
  recoveryHelp: 'Follow the email instructions to restore access. Keep the link private.',
  requestWithoutAccount: 'Request without an account',
  previousRequests: 'Recent requests',
  stepHelp: [
    'Choose the service that best describes your transport. Available options depend on your selected country.',
    'Enter both locations. Pickup and delivery must be within the available service coverage.',
    'Describe the items and quantities. Add optional photos or documents to help our team review the request.',
    'Tell us about floors, elevators and access where these apply to your service.',
    'Choose any available extras you need. These options are optional.',
    'Choose your preferred date and time window. Our team reviews the schedule with your request.',
    'Add the contact details needed to coordinate this transport.',
    'Check every detail before submitting. Use the edit buttons to return to a step.',
  ],
};
const ar: typeof en = {
  journey: 'طلب النقل، خطوة بخطوة',
  quoteIntro: 'راجع المسار والسعر النهائي وصلاحية العرض قبل الرد.',
  finalPrice: 'عرض السعر النهائي',
  quoteDecision: 'جاهز للخطوة التالية؟',
  quoteDecisionHelp:
    'اقبل العرض للانتقال إلى الدفع، أو ارفضه. يُسجَّل ردك على هذه النسخة من العرض.',
  paymentIntro: 'اختر طريقة الدفع وتابع حالته من هنا.',
  paymentReview:
    'وصل إثباتك وسيراجعه فريق المالية للتحقق من التحويل. لا تحتاج إلى رفعه مجددًا أثناء المراجعة.',
  paymentRejected: 'راجع السبب أدناه، ثم ارفع إثباتًا جديدًا. لم يتم تأكيد الدفع بعد.',
  paymentConfirmed: 'تم تأكيد الدفع. تابع طلبك للاطلاع على مستجدات النقل والتسليم.',
  transferUnavailable: 'لا توجد وسيلة تحويل متاحة لهذا الطلب حاليًا.',
  trackingIntro: 'تابع مستجدات التسليم المؤكدة هنا. تعرض هذه الصفحة آخر تقدم مسجّل لطلبك.',
  secureHelp: 'احتفظ برابطك الآمن لنفسك. رقم الطلب وحده لا يتيح الدخول إلى تفاصيله.',
  requestIntro: 'أخبرنا بما تريد نقله. يراجع فريقنا التفاصيل ويرسل لك عرض السعر النهائي.',
  reviewTitle: 'السعر قيد المراجعة',
  reviewHelp:
    'يراجع فريقنا المسار وتفاصيل النقل قبل إرسال عرض السعر النهائي. لا يُطلب منك الدفع في هذه الخطوة.',
  profileHelp: 'أضف اسمك ورقم التواصل لنتمكن من مساعدتك في طلب النقل.',
  loginHelp: 'أهلًا بعودتك. سجّل الدخول لمتابعة طلباتك وتسليماتك.',
  registerHelp: 'أنشئ حسابًا لتجد طلباتك في مكان واحد. يمكنك أيضًا طلب النقل دون تسجيل.',
  recoveryHelp: 'اتبع تعليمات البريد لاستعادة الوصول، ولا تشارك الرابط مع الآخرين.',
  requestWithoutAccount: 'اطلب دون إنشاء حساب',
  previousRequests: 'طلباتك الأخيرة',
  stepHelp: [
    'اختر الخدمة الأنسب لما تريد نقله. تعتمد الخيارات المتاحة على بلد الخدمة الذي اخترته.',
    'حدّد موقعي الاستلام والتسليم ضمن نطاق الخدمة المتاح.',
    'صف المنقولات وكمياتها. يمكنك إضافة صور أو مستندات تساعد فريقنا في مراجعة الطلب.',
    'أخبرنا عن الطوابق والمصاعد وسهولة الوصول، بحسب متطلبات خدمتك.',
    'اختر ما تحتاجه من الخدمات الإضافية المتاحة. هذه الخيارات غير إلزامية.',
    'حدّد الموعد والفترة المفضّلين لديك. يراجع فريقنا التوقيت مع تفاصيل طلبك.',
    'أضف بيانات الشخص الذي يمكن التواصل معه لتنسيق عملية النقل.',
    'راجع التفاصيل قبل الإرسال. يمكنك العودة إلى أي خطوة باستخدام أزرار التعديل.',
  ],
};
export const customerExperience = (locale: Locale) => (locale === 'ar' ? ar : en);
