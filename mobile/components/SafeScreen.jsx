import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {COLORS} from "@/constants/colors.js"

const SafeScreen = ({children}) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={{paddingTop:28, flex:1, backgroundColor: '#000000'}}>
            {children}
        </View>
    )
}

export default SafeScreen;