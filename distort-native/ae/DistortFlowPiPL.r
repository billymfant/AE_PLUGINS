#include "AEConfig.h"
#include "AE_EffectVers.h"

#ifndef AE_OS_WIN
	#include "AE_General.r"
#endif

resource 'PiPL' (16000) {
	{	/* array properties: 12 elements */
		/* [1] */
		Kind {
			AEEffect
		},
		/* [2] */
		Name {
			"Distort Flow"
		},
		/* [3] */
		Category {
			"AE Plugin Suite"
		},
#ifdef AE_OS_WIN
    #if defined(AE_PROC_INTELx64)
		CodeWin64X86 {"EffectMain"},
    #elif defined(AE_PROC_ARM64)
		CodeWinARM64 {"EffectMain"},
    #endif
#elif defined(AE_OS_MAC)
		CodeMacIntel64 {"EffectMain"},
		CodeMacARM64 {"EffectMain"},
#endif
		/* [6] */
		AE_PiPL_Version {
			2,
			0
		},
		/* [7] */
		AE_Effect_Spec_Version {
			PF_PLUG_IN_VERSION,
			PF_PLUG_IN_SUBVERS
		},
		/* [8] */
		AE_Effect_Version {
			32769	/* 0x8001 = PF_VERSION(0,1,0,PF_Stage_DEVELOP,1) */
		},
		/* [9] */
		AE_Effect_Info_Flags {
			0
		},
		/* [10] */
		/* 0x02000400 = PIX_INDEPENDENT(0x400) | DEEP_COLOR_AWARE(0x2000000).
		   VISIBLE in the Effects menu (no I_AM_OBSOLETE) for D3a manual apply.
		   MUST match GlobalSetup()'s out_flags. */
		AE_Effect_Global_OutFlags {
			0x2000400
		},
		/* 0x08001400 = SMART_RENDER(1<<10) | FLOAT_COLOR_AWARE(1<<12)
		   | SUPPORTS_THREADED_RENDERING(1<<27).  MUST match out_flags2. */
		AE_Effect_Global_OutFlags_2 {
			0x08001400
		},
		/* [11] */
		AE_Effect_Match_Name {
			"DKVB DistortFlow"
		},
		/* [12] */
		AE_Reserved_Info {
			0
		},
		/* [13] */
		AE_Effect_Support_URL {
			"https://github.com/billymfant/AE_PLUGINS"
		}
	}
};
