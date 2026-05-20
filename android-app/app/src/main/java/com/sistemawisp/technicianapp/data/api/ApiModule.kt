package com.sistemawisp.technicianapp.data.api

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.sistemawisp.technicianapp.utils.ApiConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ApiModule {
    
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        
        return OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .registerTypeAdapter(Boolean::class.java, BooleanTypeAdapter())
            .registerTypeAdapter(Boolean::class.javaPrimitiveType, BooleanTypeAdapter())
            .registerTypeAdapter(com.sistemawisp.technicianapp.data.model.Payment::class.java, com.sistemawisp.technicianapp.data.model.PaymentDeserializer())
            .registerTypeAdapter(com.sistemawisp.technicianapp.data.model.Installation::class.java, com.sistemawisp.technicianapp.data.model.InstallationDeserializer())
            .create()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, gson: Gson): Retrofit {
        return Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }
    
    @Provides
    @Singleton
    fun provideAuthService(retrofit: Retrofit): AuthService {
        return retrofit.create(AuthService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideInstallationService(retrofit: Retrofit): InstallationService {
        return retrofit.create(InstallationService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideTrafficService(retrofit: Retrofit): TrafficService {
        return retrofit.create(TrafficService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideClientService(retrofit: Retrofit): ClientService {
        return retrofit.create(ClientService::class.java)
    }
    
    @Provides
    @Singleton
    fun providePackageService(retrofit: Retrofit): PackageService {
        return retrofit.create(PackageService::class.java)
    }
    
    @Provides
    @Singleton
    fun providePaymentService(retrofit: Retrofit): PaymentService {
        return retrofit.create(PaymentService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideEmployeeService(retrofit: Retrofit): EmployeeService {
        return retrofit.create(EmployeeService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideUserService(retrofit: Retrofit): UserService {
        return retrofit.create(UserService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideNetworkService(retrofit: Retrofit): NetworkService {
        return retrofit.create(NetworkService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideIPCredentialService(retrofit: Retrofit): IPCredentialService {
        return retrofit.create(IPCredentialService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideFolioService(retrofit: Retrofit): FolioService {
        return retrofit.create(FolioService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideExpenseService(retrofit: Retrofit): ExpenseService {
        return retrofit.create(ExpenseService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideReceiptService(retrofit: Retrofit): ReceiptService {
        return retrofit.create(ReceiptService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideTransferService(retrofit: Retrofit): TransferService {
        return retrofit.create(TransferService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideQuotationService(retrofit: Retrofit): QuotationService {
        return retrofit.create(QuotationService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideContractService(retrofit: Retrofit): ContractService {
        return retrofit.create(ContractService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideProviderPaymentService(retrofit: Retrofit): ProviderPaymentService {
        return retrofit.create(ProviderPaymentService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideSupplyInvoiceService(retrofit: Retrofit): SupplyInvoiceService {
        return retrofit.create(SupplyInvoiceService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideDashboardService(retrofit: Retrofit): DashboardService {
        return retrofit.create(DashboardService::class.java)
    }
}


